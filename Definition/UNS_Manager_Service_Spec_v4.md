# UNS Manager Service — Especificación Completa v4

## Qué es este documento

Especificación de implementación del UNS Manager Service — un gestor **agnóstico** de Unified Namespace, para el proyecto UNS Platform. 

El UNS Manager funciona como fuente de verdad para los demas servicios.

Este servicio es el **plano de control** del Unified Namespace: gestiona centralizadamente el árbol ISA-95 (Enterprise, Site, Area, Equipment, Subsystem, Signal ), con sus respectivosUNS descriptive,  Informative y Analitical y sincroniza esa verdad con el broker MQTT.

## Resultado verificable

Dar de alta un equipo nuevo en la interfaz web del UNS Manager → aparece como retained en EMQX → un servicio es capaz de importar la informacion y operar en el sistema.

---

## Principio rector

**PostgreSQL es la única fuente de verdad.** Toda definición de activo, señal, UNS descriptiva, informativo y analítica vive en PostgreSQL. El broker MQTT es una proyección de esa verdad, no un almacén. Cualquier servicio consumidor (simulador, alarm service, agente IA, ML, ERP connector) es un lector de esa verdad, no un gestor.

---

## 1. Arquitectura del servicio

### 1.1 Contenedores

| Servicio | Contenedor | Puerto | Responsabilidad |
|---|---|---|---|
| UNS Manager API + UI | `uns-manager` | 8002 | Templates, CRUD ISA-95, campos informativos, importación, interfaz web |
| Sync Service | `sync-service` | — (demonio sin API) | LISTEN/NOTIFY → publicación retained en EMQX |
| PostgreSQL | `postgres` | 5432 | Fuente de verdad (schema `uns_registry`) |
| EMQX | `emqx` | 1883/8083/18083 | Broker MQTT |

### 1.2 PostgreSQL: schema único para el UNS Manager

```
PostgreSQL :5432  (galerna_platform)
└── schema: uns_registry
    ├── asset_templates              — plantillas por nivel ISA-95
    ├── template_children            — hijos predefinidos de cada plantilla
    ├── template_informational       — definición de campos _informational por template
    ├── assets                       — árbol ISA-95 real (instancias)
    ├── asset_informational          — definición de campos _informational por instancia
    └── (triggers → NOTIFY)
```

Nota: el schema `simulator` (tabla `sim_signals`) pertenece al servicio Simulator, no al UNS Manager. No se documenta aquí.

### 1.3 Flujo de datos

```
                    ┌─────────────┐
                    │  UNS Manager│
                    │  (FastAPI)  │
                    │  :8002      │
                    └──────┬──────┘
                           │ CRUD SQL
                           ▼
┌──────────────────────────────────────────┐
│  PostgreSQL  (galerna_platform)           │
│  ┌──────────────────────────────────┐    │
│  │  uns_registry                     │    │
│  │  templates + assets +             │    │
│  │  asset_informational              │    │
│  └────────────┬─────────────────────┘    │
│               │ NOTIFY 'asset_changes'    │
└───────────────┼──────────────────────────┘
                │
                ▼
         ┌──────────────┐        ┌────────────┐
         │ Sync Service │──────▶ │   EMQX     │
         │ (asyncio)    │ MQTT   │  :1883     │
         │              │ retain │  :8083 WS  │
         └──────────────┘        └────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                   │
                    ▼                  ▼                   ▼
             ┌───────────┐    ┌──────────────┐    ┌──────────────┐
             │ Simulador │    │ Alarm Service│    │ ML Service   │
             │ Node-RED  │    │              │    │              │
             │ Python    │    │              │    │              │
             └───────────┘    └──────────────┘    └──────────────┘
             publica:          lee: _descriptive   lee: _informational
             _informational    lee: _analytical     lee: TimescaleDB
                               publica:             publica:
                               _analytical/state    _analytical/state
```
Nota: el schema `simulator`, alarm service y ML service, son solo para explicar pero no se desarrollan aqui
---

## 2. Concepto: Templates vs Instancias

### 2.1 Qué es un template

Un template define la **estructura tipo** de un nivel ISA-95: qué hijos tiene por defecto, qué descriptivo lleva, qué configuración analítica, y qué campos tendrá su `_informational`. Aplica a **todos los niveles**: enterprise, site, area, equipment, subsystem.

Ejemplos de templates:
- `ENERGY_ENTERPRISE` (tipo enterprise) → campos informativos de flota: `fleet_total_active_power_kw`, `fleet_availability`, ...
- `WIND_FARM_GALICIA` (tipo area) → campos informativos de parque + define que tiene N turbinas + 1 meteo station
- `VESTAS_V90_2MW` (tipo equipment) → campos informativos de turbina + define los 12 subsystems
- `MET_MAST_60M` (tipo equipment) → define los 6 subsystems meteorológicos
- `DFIG_GENERATOR` (tipo subsystem) → define las 12 señales del generador DFIG
- `ABB_IRB_6700` (tipo equipment) → un robot industrial, para una fábrica distinta

### 2.2 Qué es una instancia

Una instancia es un asset real en el árbol ISA-95 — un T01 concreto, en un parque concreto, con sus coordenadas y su historial. Se crea de dos formas:

1. **Desde plantilla** (lo habitual): se selecciona el template y se instancia. Se copian todos los hijos y campos informativos del template como instancias reales. A partir de ese momento, la instancia **vive su propia vida** — puede divergir, añadir campos extra, eliminar subsystems que no apliquen, cambiar rangos.

2. **Manual** (sin plantilla): se crea el asset vacío y se construye a mano. Útil para activos únicos o experimentales.

### 2.3 Relación template → instancia

**No hay FK permanente.** El template es solo el punto de partida. `assets.template_id` es una referencia informativa (`SET NULL ON DELETE`) — sirve para saber "de qué plantilla nació este asset" pero no impone sincronización. Si la plantilla cambia después, las instancias existentes NO se actualizan automáticamente. Esto es intencional: en la realidad industrial, cada equipo diverge de la ficha de catálogo del fabricante con el tiempo (se añaden sensores, se sustituyen componentes, cambian rangos operativos).

### 2.4 Campos informativos — qué tiene cada nivel

Todos los niveles ISA-95 tienen un `_informational` con campos definidos en la misma tabla (`asset_informational`). La diferencia es el **origen del dato**:

| Nivel | Quién genera el `_informational` | Campos típicos |
|---|---|---|
| `subsystem` | Simulador / Gateway SCADA (publicación directa de señales) | `Gen_RPM_Avg`, `Gen_Bear_Temp_Avg`, ... (con `range_min`/`range_max`) |
| `equipment` | Aggregation Service (bubble-up desde subsystems) | `total_active_power_kw` (sum), `capacity_utilization_pct` (custom) |
| `area` | Aggregation Service (bubble-up desde equipment) | `park_total_active_power_kw` (sum), `park_availability` (avg) |
| `site` | Aggregation Service (bubble-up desde areas) | `site_total_power_kw` (sum), `site_capacity_factor` (custom) |
| `enterprise` | Aggregation Service (bubble-up desde sites) | `fleet_total_active_power_kw` (sum), `fleet_availability` (avg) |

Para `subsystem`, los campos tienen `range_min`/`range_max` y `agg_type` es NULL (dato directo de sensor, no calculado).
Para los demás niveles, los campos tienen `agg_type`/`source_field` y `range_min` es NULL (dato calculado por agregación).

El `_descriptive` de **todos** los niveles incluye un bloque `"informational_fields": {...}` que documenta qué campos lleva su `_informational`, cómo se calculan (si aplica), y cómo visualizarlos.

---

## 3. Schema `uns_registry` — DDL

### 3.1 Tipos

```sql
CREATE SCHEMA IF NOT EXISTS uns_registry;
SET search_path TO uns_registry;

CREATE TYPE asset_level AS ENUM (
    'enterprise', 'site', 'area', 'equipment', 'subsystem'
);

CREATE TYPE signal_data_type AS ENUM ('float', 'integer');

CREATE TYPE agg_type AS ENUM (
    'sum', 'avg', 'min', 'max', 'count', 'weighted_avg', 'custom'
);
```

### 3.2 Tabla `asset_templates`

```sql
CREATE TABLE asset_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level           asset_level NOT NULL,
    name            VARCHAR(100) NOT NULL UNIQUE,
    display_name    VARCHAR(200) NOT NULL DEFAULT '',
    description     TEXT,
    descriptive     JSONB NOT NULL DEFAULT '{}',
    analytical      JSONB NOT NULL DEFAULT '{}',
    icon            VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_templates_level ON asset_templates(level);
```

Ejemplos de filas:

| level | name | display_name | descriptive (extracto) |
|---|---|---|---|
| equipment | VESTAS_V90_2MW | Vestas V90-2.0MW | `{"manufacturer":"Vestas","model":"V90-2.0MW","rated_power_kw":2000,...}` |
| equipment | MET_MAST_60M | Met Mast 60m | `{"type":"met_mast","height_m":60,...}` |
| subsystem | DFIG_GENERATOR | Generador DFIG | `{"generator_type":"DFIG","rated_power_kw":2000,...}` |
| area | WIND_FARM_IBERIA | Parque Eólico Ibérico | `{"terrain":"...","iec_wind_class":"..."}` |
| equipment | ABB_IRB_6700 | Robot ABB IRB 6700 | `{"type":"industrial_robot","payload_kg":150,...}` |

### 3.3 Tabla `template_children`

Define la estructura jerárquica por defecto de cada plantilla — qué hijos se crean automáticamente al instanciar.

```sql
CREATE TABLE template_children (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_template_id UUID NOT NULL REFERENCES asset_templates(id) ON DELETE CASCADE,
    child_template_id  UUID NOT NULL REFERENCES asset_templates(id) ON DELETE CASCADE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_optional     BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT uq_template_child UNIQUE (parent_template_id, child_template_id)
);

CREATE INDEX idx_tpl_children_parent ON template_children(parent_template_id);
```

Ejemplo: el template `VESTAS_V90_2MW` tiene 12 `template_children` apuntando a los templates de subsystem (`DFIG_GENERATOR`, `PLANETARY_GEARBOX`, `HYDRAULIC_GROUP`, ...).

### 3.4 Tabla `template_informational`

Define los campos del `_informational` que se copian al instanciar un asset desde plantilla. Una sola tabla para todos los niveles.

```sql
CREATE TABLE template_informational (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     UUID NOT NULL REFERENCES asset_templates(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    unit            VARCHAR(20) NOT NULL DEFAULT '',
    data_type       signal_data_type NOT NULL,

    -- Campos de señal directa (solo subsystem, NULL para otros niveles)
    range_min       DOUBLE PRECISION,
    range_max       DOUBLE PRECISION,

    -- Campos de agregación (solo enterprise/site/area/equipment, NULL para subsystem)
    agg_type        agg_type,
    source_field    VARCHAR(100),

    -- Comunes a todos los niveles
    category        VARCHAR(50),
    is_primary      BOOLEAN NOT NULL DEFAULT false,
    chart_type      VARCHAR(20) NOT NULL DEFAULT 'time_series',
    chart_window    VARCHAR(10) NOT NULL DEFAULT '24h',
    chart_thresholds BOOLEAN NOT NULL DEFAULT false,
    aliases_es      TEXT[] DEFAULT '{}',
    aliases_en      TEXT[] DEFAULT '{}',
    description_es  TEXT,
    description_en  TEXT,

    CONSTRAINT uq_template_info_field UNIQUE (template_id, name),
    CONSTRAINT valid_agg_source CHECK (
        (agg_type IS NULL)
        OR (agg_type = 'custom' AND source_field IS NULL)
        OR (agg_type != 'custom' AND source_field IS NOT NULL)
    )
);

CREATE INDEX idx_tpl_info_template ON template_informational(template_id);
```

**Ejemplos para template `DFIG_GENERATOR` (subsystem — señales directas):**

| name | unit | range_min | range_max | agg_type | source_field | category |
|---|---|---|---|---|---|---|
| Gen_RPM_Avg | RPM | 0 | 1700 | NULL | NULL | speed |
| Gen_RPM_Max | RPM | 0 | 1800 | NULL | NULL | speed |
| Gen_Bear_Temp_Avg | °C | 10 | 100 | NULL | NULL | temperature |
| Gen_Phase1_Temp_Avg | °C | 15 | 130 | NULL | NULL | temperature |

**Ejemplos para template `VESTAS_V90_2MW` (equipment — campos agregados):**

| name | unit | range_min | range_max | agg_type | source_field | category |
|---|---|---|---|---|---|---|
| total_active_power_kw | kW | NULL | NULL | sum | Grd_Prod_Pwr_Avg | power |
| generator_rpm_avg | RPM | NULL | NULL | avg | Gen_RPM_Avg | speed |
| ambient_temp_c | °C | NULL | NULL | avg | Amb_Temp_Avg | temperature |
| capacity_utilization_pct | % | NULL | NULL | custom | NULL | performance |
| yaw_error_deg | deg | NULL | NULL | custom | NULL | alignment |

**Ejemplos para template `ENERGY_ENTERPRISE` (enterprise — campos agregados):**

| name | unit | range_min | range_max | agg_type | source_field | category |
|---|---|---|---|---|---|---|
| fleet_total_active_power_kw | kW | NULL | NULL | sum | park_total_active_power_kw | power |
| fleet_availability | % | NULL | NULL | avg | park_availability | performance |
| fleet_capacity_factor | % | NULL | NULL | custom | NULL | performance |
| fleet_turbines_producing | — | NULL | NULL | sum | turbines_producing | status |

### 3.5 Tabla `assets` (instancias)

```sql
CREATE TABLE assets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id       UUID REFERENCES assets(id) ON DELETE CASCADE,
    template_id     UUID REFERENCES asset_templates(id) ON SET NULL,
    asset_level     asset_level NOT NULL,
    name            VARCHAR(100) NOT NULL,
    uns_path        VARCHAR(500) NOT NULL UNIQUE,
    descriptive     JSONB NOT NULL DEFAULT '{}',
    analytical      JSONB NOT NULL DEFAULT '{}',
    scada_available BOOLEAN NOT NULL DEFAULT true,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT valid_parent CHECK (
        (asset_level = 'enterprise' AND parent_id IS NULL)
        OR (asset_level != 'enterprise' AND parent_id IS NOT NULL)
    ),
    CONSTRAINT uq_child_name UNIQUE (parent_id, name)
);

CREATE INDEX idx_assets_parent ON assets(parent_id);
CREATE INDEX idx_assets_level ON assets(asset_level);
CREATE INDEX idx_assets_template ON assets(template_id);
CREATE INDEX idx_assets_uns_path ON assets(uns_path);
CREATE INDEX idx_assets_active ON assets(is_active) WHERE is_active = true;
```

### 3.6 Tabla `asset_informational` (instancias)

Una sola tabla para todos los niveles — misma estructura que `template_informational`, con `is_active` y `created_at` para gestión del ciclo de vida.

```sql
CREATE TABLE asset_informational (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id        UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    unit            VARCHAR(20) NOT NULL DEFAULT '',
    data_type       signal_data_type NOT NULL,

    -- Campos de señal directa (solo subsystem)
    range_min       DOUBLE PRECISION,
    range_max       DOUBLE PRECISION,

    -- Campos de agregación (solo enterprise/site/area/equipment)
    agg_type        agg_type,
    source_field    VARCHAR(100),

    -- Comunes
    category        VARCHAR(50),
    is_primary      BOOLEAN NOT NULL DEFAULT false,
    chart_type      VARCHAR(20) NOT NULL DEFAULT 'time_series',
    chart_window    VARCHAR(10) NOT NULL DEFAULT '24h',
    chart_thresholds BOOLEAN NOT NULL DEFAULT false,
    aliases_es      TEXT[] DEFAULT '{}',
    aliases_en      TEXT[] DEFAULT '{}',
    description_es  TEXT,
    description_en  TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_info_field_per_asset UNIQUE (asset_id, name),
    CONSTRAINT valid_agg_source CHECK (
        (agg_type IS NULL)
        OR (agg_type = 'custom' AND source_field IS NULL)
        OR (agg_type != 'custom' AND source_field IS NOT NULL)
    )
);

CREATE INDEX idx_asset_info_asset ON asset_informational(asset_id);
CREATE INDEX idx_asset_info_name ON asset_informational(name);
CREATE INDEX idx_asset_info_category ON asset_informational(category);
CREATE INDEX idx_asset_info_active ON asset_informational(is_active) WHERE is_active = true;
```

### 3.7 Triggers

```sql
-- === updated_at automático ===

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_templates_updated_at
    BEFORE UPDATE ON asset_templates
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- === NOTIFY para Sync Service (solo tablas de instancias) ===

CREATE OR REPLACE FUNCTION notify_asset_change()
RETURNS TRIGGER AS $$
DECLARE
    payload JSON;
BEGIN
    IF TG_OP = 'DELETE' THEN
        payload := json_build_object(
            'operation', 'DELETE',
            'id', OLD.id,
            'uns_path', OLD.uns_path,
            'asset_level', OLD.asset_level
        );
    ELSE
        payload := json_build_object(
            'operation', TG_OP,
            'id', NEW.id,
            'uns_path', NEW.uns_path,
            'asset_level', NEW.asset_level
        );
    END IF;
    PERFORM pg_notify('asset_changes', payload::text);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_asset_notify
    AFTER INSERT OR UPDATE OR DELETE ON assets
    FOR EACH ROW EXECUTE FUNCTION notify_asset_change();

-- Notificar cambios en campos informativos (re-publica _descriptive del asset padre)
CREATE OR REPLACE FUNCTION notify_informational_change()
RETURNS TRIGGER AS $$
DECLARE
    parent_path VARCHAR;
    parent_level asset_level;
    affected_asset_id UUID;
BEGIN
    affected_asset_id := COALESCE(NEW.asset_id, OLD.asset_id);
    SELECT uns_path, asset_level INTO parent_path, parent_level
    FROM assets WHERE id = affected_asset_id;
    PERFORM pg_notify('asset_changes', json_build_object(
        'operation', 'FIELD_' || TG_OP,
        'id', affected_asset_id,
        'uns_path', parent_path,
        'asset_level', parent_level
    )::text);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_informational_notify
    AFTER INSERT OR UPDATE OR DELETE ON asset_informational
    FOR EACH ROW EXECUTE FUNCTION notify_informational_change();

-- === Extensiones ===
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Los triggers NOTIFY disparan sobre `assets` y `asset_informational` (instancias). Los cambios en templates no generan NOTIFY — las plantillas no se publican en MQTT, solo las instancias.

---

## 4. UNS Manager API — Especificación

**Contenedor**: `uns-manager`
**Framework**: FastAPI (Python 3.12)
**Dependencias**: fastapi, uvicorn, asyncpg, pydantic v2, orjson, jinja2
**Puerto**: 8002

### 4.1 Endpoints — Templates

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/templates` | Lista de templates (filtrable: `?level=equipment`) |
| `GET` | `/api/v1/templates/{id}` | Detalle con hijos y campos informativos |
| `POST` | `/api/v1/templates` | Crear template |
| `PUT` | `/api/v1/templates/{id}` | Actualizar template |
| `DELETE` | `/api/v1/templates/{id}` | Borrar template (no afecta instancias existentes) |
| `GET` | `/api/v1/templates/{id}/children` | Hijos del template |
| `POST` | `/api/v1/templates/{id}/children` | Añadir hijo al template |
| `DELETE` | `/api/v1/templates/{id}/children/{child_id}` | Quitar hijo del template |
| `GET` | `/api/v1/templates/{id}/informational` | Campos informativos del template |
| `POST` | `/api/v1/templates/{id}/informational` | Añadir campo informativo al template |
| `PUT` | `/api/v1/templates/informational/{id}` | Actualizar campo informativo de template |
| `DELETE` | `/api/v1/templates/informational/{id}` | Borrar campo informativo de template |
| `POST` | `/api/v1/templates/import` | Importar template completo desde JSON |
| `GET` | `/api/v1/templates/{id}/export` | Exportar template como JSON |

### 4.2 Endpoints — Árbol ISA-95 (Instancias)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/tree` | Árbol completo como JSON anidado |
| `GET` | `/api/v1/tree?flat=true` | Lista plana de todos los nodos |
| `GET` | `/api/v1/assets` | Lista de assets (filtrable: `?asset_level=`, `?parent_id=`, `?template_id=`) |
| `GET` | `/api/v1/assets/{id}` | Detalle de un asset con sus campos informativos |
| `POST` | `/api/v1/assets` | Crear asset manual (sin plantilla) |
| `POST` | `/api/v1/assets/from-template` | Crear asset desde plantilla (instanciación recursiva) |
| `PUT` | `/api/v1/assets/{id}` | Actualizar asset |
| `DELETE` | `/api/v1/assets/{id}` | Borrar asset (cascade a hijos + campos informativos) |

### 4.3 Endpoints — Campos informativos (Instancias)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/assets/{id}/informational` | Campos informativos de un asset |
| `POST` | `/api/v1/assets/{id}/informational` | Añadir campo informativo a un asset |
| `PUT` | `/api/v1/informational/{id}` | Actualizar campo informativo |
| `DELETE` | `/api/v1/informational/{id}` | Borrar campo informativo |

### 4.4 Endpoints — Importación/Exportación

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/v1/import/bootstrap` | Carga completa (templates + instancias) desde JSON |
| `GET` | `/api/v1/export/tree` | Exportar árbol completo como JSON |

### 4.5 Endpoints — Estado

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/status` | Estado de la API + conteos |
| `GET` | `/health` | Healthcheck (Docker) |

### 4.6 Endpoints — UI Web

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/` | SPA React (build estático servido por FastAPI) |

### 4.7 Validaciones de negocio

**Para instancias (assets):**
- Un `enterprise` no puede tener `parent_id`.
- Un `site` solo puede ser hijo de un `enterprise`.
- Un `area` solo puede ser hijo de un `site`.
- Un `equipment` solo puede ser hijo de un `area`.
- Un `subsystem` solo puede ser hijo de un `equipment`.
- `uns_path` se calcula automáticamente: `uns/v1/{path_del_padre}/{name}`. El root tiene `uns_path = uns/v1/{name}`. El cliente nunca define el path.
- Si se renombra un asset, se recalculan los `uns_path` de todos los descendientes.
- Campos informativos de **subsystem**: `range_min`/`range_max` requeridos, `agg_type`/`source_field` deben ser NULL.
- Campos informativos de **otros niveles**: `agg_type` requerido, `range_min`/`range_max` deben ser NULL.
- Nombres de assets: solo UPPER_CASE alfanumérico + underscore (`^[A-Z0-9_]+$`).
- UNIQUE(parent_id, name) — sin hijos duplicados.

**Para templates:**
- `template_children` solo puede vincular templates de niveles consecutivos (un template de `equipment` solo puede tener hijos de nivel `subsystem`, etc.).
- Las mismas reglas de campos informativos por nivel aplican a `template_informational`.
- El nombre del template es único globalmente.

**Para instanciación desde template (`POST /api/v1/assets/from-template`):**
- Se recorre recursivamente `template_children` y se crea cada nivel como asset real.
- Se copian `descriptive` y `analytical` del template a la instancia.
- Se copian `template_informational` → `asset_informational`.
- El cliente proporciona: `parent_id`, `template_id`, `name` (y opcionalmente override de descriptive/analytical).
- Toda la operación es una sola transacción SQL — rollback completo si falla cualquier parte.

### 4.8 Pydantic Models

```python
# === Template models ===

class TemplateCreate(BaseModel):
    level: Literal['enterprise','site','area','equipment','subsystem']
    name: str                           # VESTAS_V90_2MW
    display_name: str = ''              # Vestas V90-2.0MW
    description: str | None = None
    descriptive: dict = {}
    analytical: dict = {}
    icon: str | None = None

class TemplateUpdate(BaseModel):
    display_name: str | None = None
    description: str | None = None
    descriptive: dict | None = None
    analytical: dict | None = None
    icon: str | None = None

class TemplateChildAdd(BaseModel):
    child_template_id: UUID
    sort_order: int = 0
    is_optional: bool = False

class InformationalFieldCreate(BaseModel):
    """Usado tanto para template_informational como asset_informational."""
    name: str
    unit: str = ''
    data_type: Literal['float','integer']
    range_min: float | None = None          # solo subsystem
    range_max: float | None = None          # solo subsystem
    agg_type: Literal['sum','avg','min','max','count','weighted_avg','custom'] | None = None
    source_field: str | None = None         # requerido si agg_type != 'custom' y != None
    category: str | None = None
    is_primary: bool = False
    chart_type: str = 'time_series'
    chart_window: str = '24h'
    chart_thresholds: bool = False
    aliases_es: list[str] = []
    aliases_en: list[str] = []
    description_es: str | None = None
    description_en: str | None = None

class InformationalFieldUpdate(BaseModel):
    unit: str | None = None
    range_min: float | None = None
    range_max: float | None = None
    agg_type: Literal['sum','avg','min','max','count','weighted_avg','custom'] | None = None
    source_field: str | None = None
    category: str | None = None
    is_primary: bool | None = None
    chart_type: str | None = None
    chart_window: str | None = None
    chart_thresholds: bool | None = None
    aliases_es: list[str] | None = None
    aliases_en: list[str] | None = None
    description_es: str | None = None
    description_en: str | None = None
    is_active: bool | None = None           # solo en instancias

class TemplateResponse(BaseModel):
    id: UUID
    level: str
    name: str
    display_name: str
    description: str | None
    descriptive: dict
    analytical: dict
    icon: str | None
    children: list['TemplateResponse'] | None = None
    informational: list['InformationalFieldResponse'] | None = None
    created_at: datetime
    updated_at: datetime

class InformationalFieldResponse(BaseModel):
    id: UUID
    template_id: UUID | None = None     # presente si viene de template
    asset_id: UUID | None = None        # presente si viene de instancia
    name: str
    unit: str
    data_type: str
    range_min: float | None
    range_max: float | None
    agg_type: str | None
    source_field: str | None
    category: str | None
    is_primary: bool
    chart_type: str
    chart_window: str
    chart_thresholds: bool
    aliases_es: list[str]
    aliases_en: list[str]
    description_es: str | None
    description_en: str | None
    is_active: bool | None = None       # solo en instancias

# === Asset instance models ===

class AssetCreate(BaseModel):
    parent_id: UUID | None = None
    asset_level: Literal['enterprise','site','area','equipment','subsystem']
    name: str                           # validado: ^[A-Z0-9_]+$
    descriptive: dict = {}
    analytical: dict = {}
    scada_available: bool = True

class AssetFromTemplate(BaseModel):
    parent_id: UUID | None = None
    template_id: UUID
    name: str                           # nombre de la instancia (ej: T01)
    descriptive_overrides: dict = {}    # merge sobre el descriptive del template
    analytical_overrides: dict = {}     # merge sobre el analytical del template

class AssetUpdate(BaseModel):
    name: str | None = None
    descriptive: dict | None = None
    analytical: dict | None = None
    scada_available: bool | None = None
    is_active: bool | None = None

class AssetResponse(BaseModel):
    id: UUID
    parent_id: UUID | None
    template_id: UUID | None
    template_name: str | None           # denormalizado para display
    asset_level: str
    name: str
    uns_path: str
    descriptive: dict
    analytical: dict
    scada_available: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    informational: list[InformationalFieldResponse] | None = None
    children: list['AssetResponse'] | None = None

class StatusResponse(BaseModel):
    service: str = 'uns-manager'
    version: str
    templates_count: int
    assets_count: int
    informational_fields_count: int
    assets_by_level: dict[str, int]
```

### 4.9 Instanciación desde template — Algoritmo

```python
async def instantiate_from_template(
    parent_id: UUID | None,
    template_id: UUID,
    name: str,
    descriptive_overrides: dict,
    analytical_overrides: dict,
    conn  # asyncpg connection in transaction
) -> UUID:
    """Crea recursivamente un asset y todos sus hijos desde un template."""

    # 1. Leer template
    tpl = await conn.fetchrow("SELECT * FROM asset_templates WHERE id = $1", template_id)

    # 2. Merge descriptive: template base + overrides del usuario
    descriptive = {**tpl['descriptive'], **descriptive_overrides}
    analytical = {**tpl['analytical'], **analytical_overrides}

    # 3. Calcular uns_path
    if parent_id:
        parent_path = await conn.fetchval(
            "SELECT uns_path FROM assets WHERE id = $1", parent_id
        )
        uns_path = f"{parent_path}/{name}"
    else:
        uns_path = f"uns/v1/{name}"

    # 4. INSERT asset
    asset_id = await conn.fetchval("""
        INSERT INTO assets (parent_id, template_id, asset_level, name, uns_path,
                           descriptive, analytical)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    """, parent_id, template_id, tpl['level'], name, uns_path,
         json.dumps(descriptive), json.dumps(analytical))

    # 5. Copiar template_informational → asset_informational (mismo código para todos los niveles)
    tpl_fields = await conn.fetch(
        "SELECT * FROM template_informational WHERE template_id = $1", template_id
    )
    for f in tpl_fields:
        await conn.execute("""
            INSERT INTO asset_informational (asset_id, name, unit, data_type,
                range_min, range_max, agg_type, source_field,
                category, is_primary, chart_type, chart_window,
                chart_thresholds, aliases_es, aliases_en,
                description_es, description_en)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        """, asset_id, f['name'], f['unit'], f['data_type'],
             f['range_min'], f['range_max'], f['agg_type'], f['source_field'],
             f['category'], f['is_primary'], f['chart_type'], f['chart_window'],
             f['chart_thresholds'], f['aliases_es'], f['aliases_en'],
             f['description_es'], f['description_en'])

    # 6. Recursión: instanciar hijos del template
    children = await conn.fetch("""
        SELECT child_template_id, sort_order FROM template_children
        WHERE parent_template_id = $1 AND is_optional = false
        ORDER BY sort_order
    """, template_id)
    for child in children:
        child_tpl = await conn.fetchrow(
            "SELECT name FROM asset_templates WHERE id = $1",
            child['child_template_id']
        )
        await instantiate_from_template(
            parent_id=asset_id,
            template_id=child['child_template_id'],
            name=child_tpl['name'],
            descriptive_overrides={},
            analytical_overrides={},
            conn=conn
        )

    return asset_id
```

---

## 5. Sync Service — Especificación

**Contenedor**: `sync-service`
**Framework**: Python 3.12, asyncio puro
**Dependencias**: asyncpg, aiomqtt, orjson
**Puerto**: ninguno

### 5.1 Arranque — Full Sync

```
1. Conectar a PostgreSQL (schema uns_registry)
2. Conectar a EMQX como cliente MQTT
3. SELECT todos los assets con is_active=true
   ORDER BY array_position(ARRAY['enterprise','site','area','equipment','subsystem'], asset_level::text)
4. Para cada asset:
   a. Construir topic: {uns_path}/_descriptive
   b. Construir payload (ver §5.3)
   c. Publicar con retained=true, QoS=1
   d. Si asset.analytical != '{}': publicar {uns_path}/_analytical con retained=true
5. Log: "Full sync completed: {n} _descriptive, {m} _analytical published"
```

### 5.2 Escucha continua — Incremental

```
1. LISTEN 'asset_changes' en PostgreSQL
2. Al recibir notificación:
   a. Parsear JSON (operation, id, uns_path, asset_level)
   b. DELETE → publicar payload vacío (borra retained)
   c. INSERT/UPDATE → re-publicar _descriptive + _analytical
   d. FIELD_* → re-publicar _descriptive del asset afectado
```

### 5.3 Construcción de payloads

#### `_descriptive` — mismo código para todos los niveles

```python
base = dict(asset.descriptive)
fields = {}
for f in info_rows:  # SELECT * FROM asset_informational WHERE asset_id = ... AND is_active = true
    entry = {
        "unit": f.unit,
        "data_type": f.data_type,
        "default_chart": {
            "type": f.chart_type,
            "show_thresholds": f.chart_thresholds,
            "recommended_window": f.chart_window
        }
    }
    # Añadir campos específicos según lo que tenga la fila
    if f.range_min is not None:
        entry["range_min"] = f.range_min
        entry["range_max"] = f.range_max
    if f.agg_type is not None:
        entry["agg_type"] = f.agg_type
        entry["source_field"] = f.source_field

    fields[f.name] = entry

base["informational_fields"] = fields
payload = base

# Ejemplo para GENERATOR (subsystem):
# {
#   "generator_type": "DFIG", "rated_power_kw": 2000, ...
#   "informational_fields": {
#     "Gen_RPM_Avg": {"unit": "RPM", "data_type": "float", "range_min": 0, "range_max": 1700, "default_chart": {...}},
#     "Gen_Bear_Temp_Avg": {"unit": "°C", "data_type": "integer", "range_min": 10, "range_max": 100, "default_chart": {...}},
#     ...
#   }
# }

# Ejemplo para T01 (equipment):
# {
#   "equipment_id": "T01", "manufacturer": "Vestas", ...
#   "informational_fields": {
#     "total_active_power_kw": {"unit": "kW", "data_type": "float", "agg_type": "sum", "source_field": "Grd_Prod_Pwr_Avg", "default_chart": {...}},
#     "capacity_utilization_pct": {"unit": "%", "data_type": "float", "agg_type": "custom", "source_field": null, "default_chart": {...}},
#     ...
#   }
# }
```

#### `_analytical` (config estática — thresholds, targets)

```python
payload = asset.analytical
```

Nota: `_analytical` solo contiene configuración estática gestionada por el UNS Manager (thresholds, targets, health score baseline). Los resultados computados en vivo (alarmas activas, predicciones ML) se publican por sus respectivos servicios en `_analytical/state` — un subtopic separado que el UNS Manager nunca toca (ver §7).

### 5.4 Resiliencia

- Reconexión MQTT con backoff exponencial (1s→60s max).
- Reconexión PostgreSQL con backoff + full sync al reconectar.
- Full sync siempre al arrancar, antes de LISTEN.

---

## 6. Interfaz Web — UNS Manager UI

### 6.1 Tecnología

React SPA (Vite + Tailwind) servida como build estático por FastAPI en el mismo contenedor.

### 6.2 Dos secciones principales

```
┌──────────────────────────────────────────────────────────────────┐
│  UNS Manager                            [Templates] [Assets]     │
├──────────────────────────────────────────────────────────────────┤
```

#### Sección 1: Templates

```
┌──────────────────┬───────────────────────────────────────────────┐
│                  │                                               │
│  TEMPLATES       │  EDITOR DE TEMPLATE                           │
│                  │                                               │
│  ── equipment ── │  Nombre: VESTAS_V90_2MW                       │
│  VESTAS_V90_2MW  │  Display: Vestas V90-2.0MW                   │
│  MET_MAST_60M    │  Nivel: equipment                             │
│  ABB_IRB_6700    │                                               │
│                  │  ┌─ Descriptive (JSON) ────────────────────┐  │
│  ── subsystem ── │  │ { "manufacturer": "Vestas",             │  │
│  DFIG_GENERATOR  │  │   "model": "V90-2.0MW",                │  │
│  PLANETARY_GBOX  │  │   "rated_power_kw": 2000, ... }        │  │
│  HYDRAULIC_GRP   │  └────────────────────────────────────────┘  │
│  ...             │                                               │
│                  │  ┌─ Hijos (12 subsystems) ─────────────────┐  │
│  ── area ──────  │  │ DFIG_GENERATOR    subsystem  requerido   │  │
│  WIND_FARM_IBER  │  │ PLANETARY_GBOX    subsystem  requerido   │  │
│                  │  │ HYDRAULIC_GRP     subsystem  opcional    │  │
│  ── enterprise ─ │  │ ...                                      │  │
│  ENERGY_CORP     │  │ [+ Añadir hijo]                          │  │
│                  │  └────────────────────────────────────────┘  │
│  [+ Nuevo]       │                                               │
│  [↑ Importar]    │  ┌─ Campos informativos (7) ──────────────┐  │
│                  │  │ total_active_power_kw  kW  sum    ✓      │  │
│                  │  │ generator_rpm_avg      RPM avg           │  │
│                  │  │ capacity_util_pct      %   custom        │  │
│                  │  │ [+ Nuevo campo]                          │  │
│                  │  └────────────────────────────────────────┘  │
│                  │                                               │
│                  │  [Guardar]  [Exportar JSON]  [Eliminar]       │
└──────────────────┴───────────────────────────────────────────────┘
```

Para templates de subsystem, la tabla muestra columnas `range_min`/`range_max`.
Para templates de otros niveles, la tabla muestra columnas `agg_type`/`source_field`.

#### Sección 2: Assets (instancias)

```
┌──────────────────┬───────────────────────────────────────────────┐
│                  │                                               │
│  ÁRBOL ISA-95    │  INSPECTOR                                    │
│                  │                                               │
│  ▼ GALERNA_ENERGY│  Nombre: T01                                  │
│    ▼ SPAIN       │  Nivel: equipment                             │
│      ▼ GALICIA.. │  Template: VESTAS_V90_2MW                     │
│        ▶ T01  ◀──│  UNS Path: uns/v1/.../T01                    │
│        ▶ T06     │  SCADA: ✓                                    │
│        ▶ T07     │                                               │
│        ▶ T09     │  ┌─ Descriptive (JSON) ────────────────────┐  │
│        ▶ T11     │  │ { "equipment_id": "T01",                │  │
│        ▶ METEO.. │  │   "manufacturer": "Vestas",             │  │
│      ▶ CASTILLA..│  │   "serial_number": "VES-...", ...}      │  │
│      ▶ ARAGON..  │  └────────────────────────────────────────┘  │
│    ▶ PORTUGAL    │                                               │
│                  │  ┌─ Analytical (JSON) ─────────────────────┐  │
│  ──────────────  │  │ { "thresholds": {...},                   │  │
│  [+ Manual]      │  │   "health_score": {...} }                │  │
│  [+ Template ▼]  │  └────────────────────────────────────────┘  │
│  [↑ Bootstrap]   │                                               │
│                  │  ┌─ Campos informativos (7) ──────────────┐  │
│                  │  │ total_active_power_kw  kW  sum    ✓      │  │
│                  │  │ generator_rpm_avg      RPM avg           │  │
│                  │  │ capacity_util_pct      %   custom        │  │
│                  │  │ ...                                      │  │
│                  │  │ [+ Nuevo campo]                          │  │
│                  │  └────────────────────────────────────────┘  │
│                  │                                               │
│                  │  [Guardar]  [Eliminar]                        │
├──────────────────┴───────────────────────────────────────────────┤
│  Assets: 74  │  Fields: 487  │  Templates: 18  │  Sync: ●       │
└──────────────────────────────────────────────────────────────────┘
```

El botón `[+ Template ▼]` abre un dropdown con los templates disponibles para el nivel correspondiente al parent seleccionado, y al seleccionar uno ejecuta `POST /api/v1/assets/from-template`.

### 6.3 Dependencias React

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "@tanstack/react-query": "^5",
    "react-arborist": "^3",
    "@monaco-editor/react": "^4"
  },
  "devDependencies": {
    "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "tailwindcss": "^3"
  }
}
```

---

## 7. Comunicación con otros servicios

### 7.1 Principio de integración

El UNS Manager publica configuración estática (`_descriptive`, `_analytical`). **No gestiona datos en vivo.** Los servicios consumidores descubren la estructura del UNS vía MQTT retained (suscribiéndose con wildcards) y publican sus propios resultados en sus propios topics.

### 7.2 Separación `_analytical` vs `_analytical/state`

| Topic | Quién escribe | Qué contiene | Frecuencia |
|---|---|---|---|
| `.../_analytical` | UNS Manager (vía Sync Service) | Config estática: thresholds, targets, setpoints, versión | Baja (edición manual) |
| `.../_analytical/state` | Alarm Service, ML Service, etc. | Resultado vivo: alarma activa, health score dinámico, predicción | Continua |

El UNS Manager **nunca toca** `_analytical/state`. Los servicios computacionales **nunca tocan** `_analytical`. Esto elimina el conflicto de doble escritor.

### 7.3 Cómo descubre cada servicio qué vigilar

Cada servicio al arrancar se suscribe a los retained de `_descriptive` y `_analytical`:

```python
# Alarm Service al arrancar:
await client.subscribe("uns/v1/+/+/+/+/+/_descriptive")   # todos los subsystems
await client.subscribe("uns/v1/+/+/+/+/+/_analytical")    # sus thresholds

# Recibe automáticamente todos los retained → reconstruye su catálogo interno
# Después se suscribe al dato vivo:
await client.subscribe("uns/v1/+/+/+/+/+/_informational")
```

Si se añade o modifica un campo informativo en el UNS Manager, el Sync Service re-publica el `_descriptive` → el servicio consumidor lo recibe como mensaje normal (ya estaba suscrito) → actualiza su catálogo en memoria. **No necesita llamar a ninguna API ni consultar la base de datos.**

### 7.4 Servicios y su relación con el UNS

| Servicio | Lee del UNS Manager | Publica a MQTT |
|---|---|---|
| **Simulador** (Python/Node-RED) | `_descriptive` (bloque `informational_fields` para saber qué generar) | `_informational` (valores simulados) |
| **Alarm Service** | `_descriptive` (campos activos) + `_analytical` (thresholds) | `_analytical/state` (estado de alarma) |
| **ML Service** | `_informational` (vía MQTT) + TimescaleDB (histórico) | `_analytical/state` (predicciones) |
| **Agregador** | `_descriptive` (bloque `informational_fields` con `agg_type`+`source_field`) + `_informational` de hijos | `_informational` de padres (bubble-up, guiado por el catálogo) |
| **ERP/CRM Connector** | `_descriptive` (inventario) + `_analytical/state` (alarmas) | Llamadas REST/SOAP al ERP (no publica a MQTT) |
| **Frontend SCADA** | `_descriptive` (catálogo para UI) + `_informational` (valores vivos vía WebSocket) | No publica |
| **Agente IA** | Redis cache del catálogo (hot path) + API REST (cold path) | No publica a MQTT directamente |

### 7.5 El UNS Manager no necesita saber que estos servicios existen

Esta es la propiedad clave del patrón pub/sub: el UNS Manager hace su trabajo (CRUD → PostgreSQL → Sync → MQTT retained) sin importarle quién consume los topics. Si mañana añades un servicio de "digital twin" que necesita saber la estructura del parque, simplemente se suscribe a `_descriptive` — no hay que registrarlo, configurarlo, ni tocar una línea del UNS Manager.

---

## 8. Smoke Test

**Archivo**: `tests/smoke_test_uns.py`
**Dependencias**: httpx, aiomqtt, pytest, pytest-asyncio
**No accede a PostgreSQL directamente — solo HTTP + MQTT.**

```python
"""
Smoke test — valida el ciclo completo:
API → PostgreSQL trigger → NOTIFY → Sync Service → EMQX retained

Requiere: docker compose up postgres emqx uns-manager sync-service
"""

import asyncio, json
import httpx, aiomqtt, pytest

API = "http://localhost:8002/api/v1"
MQTT_HOST, MQTT_PORT, TIMEOUT = "localhost", 1883, 5

async def wait_retained(topic, timeout=TIMEOUT):
    async with aiomqtt.Client(MQTT_HOST, MQTT_PORT) as c:
        await c.subscribe(topic)
        try:
            async with asyncio.timeout(timeout):
                async for msg in c.messages:
                    return json.loads(msg.payload) if msg.payload else None
        except TimeoutError:
            return "TIMEOUT"

@pytest.mark.asyncio
async def test_01_create_asset_publishes_descriptive():
    async with httpx.AsyncClient() as h:
        r = await h.post(f"{API}/assets", json={
            "asset_level": "enterprise", "name": "SMOKE_TEST",
            "descriptive": {"test": True}
        })
        assert r.status_code == 201
        topic = f"{r.json()['uns_path']}/_descriptive"
    p = await wait_retained(topic)
    assert p != "TIMEOUT" and p["test"] is True

@pytest.mark.asyncio
async def test_02_update_republishes():
    async with httpx.AsyncClient() as h:
        r = await h.post(f"{API}/assets", json={
            "asset_level": "enterprise", "name": "SMOKE_UPD",
            "descriptive": {"v": 1}
        })
        asset = r.json()
        topic = f"{asset['uns_path']}/_descriptive"
        await wait_retained(topic)
        await h.put(f"{API}/assets/{asset['id']}", json={"descriptive": {"v": 2}})
    assert (await wait_retained(topic))["v"] == 2

@pytest.mark.asyncio
async def test_03_delete_clears_retained():
    async with httpx.AsyncClient() as h:
        r = await h.post(f"{API}/assets", json={
            "asset_level": "enterprise", "name": "SMOKE_DEL"
        })
        asset = r.json()
        topic = f"{asset['uns_path']}/_descriptive"
        await wait_retained(topic)
        await h.delete(f"{API}/assets/{asset['id']}")
    assert (await wait_retained(topic)) is None

@pytest.mark.asyncio
async def test_04_field_change_republishes():
    async with httpx.AsyncClient() as h:
        ids = {}
        for lvl, name, parent_key in [
            ("enterprise", "SMOKE_FLD", None),
            ("site", "S", "enterprise"),
            ("area", "A", "site"),
            ("equipment", "EQ", "area"),
            ("subsystem", "SUB", "equipment"),
        ]:
            body = {"asset_level": lvl, "name": name}
            if parent_key: body["parent_id"] = ids[parent_key]
            ids[lvl] = (await h.post(f"{API}/assets", json=body)).json()["id"]

        sub = (await h.get(f"{API}/assets/{ids['subsystem']}")).json()
        topic = f"{sub['uns_path']}/_descriptive"
        await wait_retained(topic)

        await h.post(f"{API}/assets/{ids['subsystem']}/informational", json={
            "name": "Test_Signal", "unit": "RPM", "data_type": "float",
            "range_min": 0, "range_max": 1700
        })
    p = await wait_retained(topic)
    assert "Test_Signal" in p["informational_fields"]

@pytest.mark.asyncio
async def test_05_instantiate_from_template():
    async with httpx.AsyncClient() as h:
        # Crear template de subsystem con campo informativo
        tpl = (await h.post(f"{API}/templates", json={
            "level": "subsystem", "name": "SMOKE_TPL_SUB",
            "descriptive": {"type": "test_sub"}
        })).json()
        await h.post(f"{API}/templates/{tpl['id']}/informational", json={
            "name": "Tpl_Signal", "unit": "V", "data_type": "float",
            "range_min": 0, "range_max": 500
        })

        # Crear jerarquía manual hasta equipment
        ent = (await h.post(f"{API}/assets", json={
            "asset_level": "enterprise", "name": "SMOKE_TPL"
        })).json()
        site = (await h.post(f"{API}/assets", json={
            "asset_level": "site", "name": "S", "parent_id": ent["id"]
        })).json()
        area = (await h.post(f"{API}/assets", json={
            "asset_level": "area", "name": "A", "parent_id": site["id"]
        })).json()
        eq = (await h.post(f"{API}/assets", json={
            "asset_level": "equipment", "name": "EQ", "parent_id": area["id"]
        })).json()

        # Instanciar subsystem desde template
        inst = (await h.post(f"{API}/assets/from-template", json={
            "parent_id": eq["id"],
            "template_id": tpl["id"],
            "name": "SUB_FROM_TPL"
        })).json()

        topic = f"{inst['uns_path']}/_descriptive"

    p = await wait_retained(topic)
    assert p["type"] == "test_sub"
    assert "Tpl_Signal" in p["informational_fields"]
```

---

## 9. Docker Compose

```yaml
services:
  postgres:
    image: timescale/timescaledb:latest-pg16
    container_name: galerna-postgres
    ports:
      - "${POSTGRES_HOST_PORT:-5432}:5432"
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-galerna}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-galerna_platform}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./db/init-platform.sql:/docker-entrypoint-initdb.d/01-init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-galerna}"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - galerna

  emqx:
    image: emqx/emqx:5.8
    container_name: galerna-emqx
    ports:
      - "1883:1883"
      - "8083:8083"
      - "18083:18083"
    volumes:
      - emqx_data:/opt/emqx/data
    environment:
      EMQX_DASHBOARD__DEFAULT_USERNAME: admin
      EMQX_DASHBOARD__DEFAULT_PASSWORD: ${EMQX_DASHBOARD_PASSWORD:-public}
    networks:
      - galerna

  redis:
    image: redis:7-alpine
    container_name: galerna-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - galerna

  uns-manager:
    build: ./services/uns-manager
    container_name: galerna-uns-manager
    ports:
      - "${UNS_MANAGER_HOST_PORT:-8002}:8002"
    depends_on:
      postgres:
        condition: service_healthy
    env_file: .env
    networks:
      - galerna

  sync-service:
    build: ./services/sync-service
    container_name: galerna-sync-service
    depends_on:
      postgres:
        condition: service_healthy
      emqx:
        condition: service_started
    env_file: .env
    restart: unless-stopped
    networks:
      - galerna

volumes:
  postgres_data:
  emqx_data:
  redis_data:

networks:
  galerna:
    driver: bridge
```

### Variables de entorno (.env.example)

```env
# === PostgreSQL ===
POSTGRES_USER=galerna
POSTGRES_PASSWORD=change_me_postgres
POSTGRES_DB=galerna_platform
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# === EMQX ===
EMQX_DASHBOARD_PASSWORD=change_me_emqx

# === UNS Manager ===
UNS_MANAGER_HOST_PORT=8002

# === Sync Service ===
MQTT_HOST=emqx
MQTT_PORT=1883
MQTT_SYNC_USER=sync_service
MQTT_SYNC_PASSWORD=change_me_sync
```

---

## 10. Orden de implementación

### Paso 1: DDL + PostgreSQL

1. Crear `db/init-platform.sql` con todo el DDL (templates + instancias + triggers).
2. Docker compose up postgres.
3. **Verificar**: psql → confirmar tablas `asset_templates`, `template_children`, `template_informational`, `assets`, `asset_informational`.

### Paso 2: UNS Manager API — Templates

1. Crear `services/uns-manager/` con FastAPI.
2. Implementar CRUD de templates + template_children + template_informational.
3. **Verificar**: Swagger en `:8002/docs` → crear template VESTAS_V90_2MW con hijos y campos informativos.

### Paso 3: UNS Manager API — Assets

1. Implementar CRUD de assets (manual).
2. Implementar `POST /api/v1/assets/from-template` (instanciación recursiva).
3. Implementar CRUD de asset_informational.
4. **Verificar**: instanciar una turbina desde template → 1 equipment + 12 subsystems + 81 señales + 7 campos agregados creados.

### Paso 4: Bootstrap

1. Crear `scripts/bootstrap_uns.py` — primero carga templates, luego instancia el árbol de Galerna.
2. **Verificar**: ~18 templates + ~74 assets + ~487 campos informativos.

### Paso 5: Sync Service

1. Crear `services/sync-service/`.
2. Full sync al arranque + LISTEN/NOTIFY.
3. **Verificar**: EMQX dashboard → 74+ topics `_descriptive` retained, todos con bloque `informational_fields`.

### Paso 6: Smoke Test

1. `pytest tests/smoke_test_uns.py -v`
2. **Verificar**: 5 tests pasan (create, update, delete, field change, template instantiation).

### Paso 7: UNS Manager UI

1. Scaffold React (Vite + Tailwind).
2. Sección Templates: lista + editor + hijos + campos informativos de template.
3. Sección Assets: árbol + inspector + instanciación desde template.
4. Build estático → `services/uns-manager/static/`.
5. **Verificar**: crear template desde UI → instanciar equipo → aparece en EMQX.

---

## 11. Estructura de directorios

```
SCADA_V2/
├── db/
│   └── init-platform.sql
├── services/
│   ├── uns-manager/
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── main.py
│   │   ├── routers/
│   │   │   ├── templates.py              # CRUD templates + children + informational
│   │   │   ├── assets.py                 # CRUD assets + from-template
│   │   │   ├── informational.py          # CRUD asset_informational
│   │   │   └── imports.py                # bootstrap
│   │   ├── models/
│   │   │   ├── schemas.py                # Pydantic models
│   │   │   └── database.py               # asyncpg pool
│   │   ├── services/
│   │   │   ├── template_service.py       # lógica de templates
│   │   │   ├── asset_service.py          # lógica de instancias
│   │   │   ├── instantiation.py          # algoritmo recursivo de instanciación
│   │   │   └── path_service.py           # cálculo de uns_path
│   │   └── static/                       # React build
│   │       └── index.html
│   ├── sync-service/
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── main.py
│   └── simulator/
│       └── ...
├── tests/
│   └── smoke_test_uns.py
├── scripts/
│   └── bootstrap_uns.py
├── docker-compose.yml
└── .env.example
```

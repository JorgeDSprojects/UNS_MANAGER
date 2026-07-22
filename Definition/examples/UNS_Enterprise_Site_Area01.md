# UNS Definitions — Enterprise, Site & Area

## Contexto ficticio inventado

**Galerna Energy S.A.** es un operador independiente de energía renovable (IPP) con sede en Bilbao, fundado en 2008. Para este MVP, el inventario operativo activo se limita a SPAIN/GALICIA_COSTA_MORTE con turbinas T01, T06, T07, T09 (no_scada), T11 y el equipo METEO_STATION. Otros parques y sitios se consideran fuera de alcance del MVP y quedan solo como referencia futura.

---

## 1. Enterprise — GALERNA_ENERGY

### Topic base
```
uns/v1/GALERNA_ENERGY/
```

### `_descriptive` — Identidad corporativa y estructura

```
uns/v1/GALERNA_ENERGY/_descriptive
```

MQTT: `retained=true` · Almacenamiento: PostgreSQL · Frecuencia de cambio: muy baja (meses/años)

```json
{
  "schema_version": "1.0.0",
  "enterprise_id": "GALERNA_ENERGY",
  "legal_name": "Galerna Energy S.A.",
  "trade_name": "Galerna Energy",
  "cif": "B-48XXXXXX",
  "headquarters": {
    "city": "Bilbao",
    "province": "Bizkaia",
    "country": "ES",
    "address": "Gran Vía 50, 48011 Bilbao",
    "timezone": "Europe/Madrid"
  },
  "founded": "2008-03-15",
  "sector": "renewable_energy",
  "technology": ["onshore_wind"],
  "fleet_summary": {
    "total_sites": 1,
    "total_parks": 1,
    "total_turbines": 5,
    "total_installed_capacity_mw": 10,
    "countries": ["ES"]
  },
  "certifications": ["ISO 14001:2015", "ISO 45001:2018", "ISO 55001:2014"],
  "scada_platform": "UNS Conversational Explorer v1",
  "contact": {
    "operations_center": "+34 944 XXX XXX",
    "emergency": "+34 900 XXX XXX"
  },
  "sites": [
    {
      "site_id": "SPAIN",
      "description": "Operaciones en España (alcance MVP)",
      "parks": ["ESGALCM002"]
    }
  ],
  "future_assets_out_of_scope": {
    "sites": ["PORTUGAL"],
    "parks": ["ESCLEBA015", "ESARAHU009", "PTALEAL003"]
  }
}
```

### `_informational` — KPIs operativos de flota (bubble-up)

```
uns/v1/GALERNA_ENERGY/_informational
```

MQTT: `retained=false` · Almacenamiento: TimescaleDB · Frecuencia: cada 15 min (agregación)

```json
{
  "timestamp": "2016-01-01T00:15:00+00:00",
  "aggregation_window": "15min",
  "fleet_total_active_power_kw": 74668.0,
  "fleet_capacity_factor": 0.311,
  "fleet_availability": 0.800,
  "fleet_turbines_producing": 4,
  "fleet_turbines_total": 5,
  "fleet_turbines_faulted": 0,
  "fleet_turbines_maintenance": 0,
  "fleet_turbines_curtailed": 0,
  "fleet_avg_wind_speed_ms": 4.15,
  "fleet_total_energy_kwh_today": 12445.0,
  "sites_summary": [
    {
      "site_id": "SPAIN",
      "active_power_kw": 74668.0,
      "availability": 0.800,
      "turbines_producing": 4
    }
  ]
}
```

### `_analytical` — Objetivos, umbrales de negocio y scoring

```
uns/v1/GALERNA_ENERGY/_analytical
```

MQTT: `retained=true` · Almacenamiento: PostgreSQL (versionado) · Frecuencia de cambio: trimestral/anual

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00",
  "version": 2,
  "business_targets": {
    "annual_availability_target": 0.95,
    "annual_capacity_factor_target": 0.28,
    "annual_production_target_mwh": 30500,
    "max_unplanned_downtime_hours_per_turbine": 120,
    "mtbf_target_hours": 2500,
    "mttr_target_hours": 48
  },
  "fleet_health_score": {
    "value": 0.88,
    "confidence": 0.85,
    "calculated_at": "2016-01-01T00:00:00+00:00",
    "model": "weighted_component_health_v2"
  },
  "alarm_escalation_policy": {
    "level_1_notify": ["park_operator"],
    "level_2_notify": ["park_operator", "regional_manager"],
    "level_3_notify": ["park_operator", "regional_manager", "operations_director"],
    "escalation_timeout_minutes": [15, 60, 240]
  }
}
```

---

## 2. Site — SPAIN

### Topic base
```
uns/v1/GALERNA_ENERGY/SPAIN/
```

### `_descriptive` — Contexto regional de operación

```
uns/v1/GALERNA_ENERGY/SPAIN/_descriptive
```

MQTT: `retained=true` · Almacenamiento: PostgreSQL · Frecuencia de cambio: baja

```json
{
  "schema_version": "1.0.0",
  "site_id": "SPAIN",
  "country": "ES",
  "country_name": "España",
  "regulatory_body": "CNMC",
  "grid_operator": "Red Eléctrica de España (REE)",
  "market_operator": "OMIE",
  "currency": "EUR",
  "timezone": "Europe/Madrid",
  "regional_office": {
    "city": "Bilbao",
    "address": "Gran Vía 50, 48011 Bilbao",
    "phone": "+34 944 XXX XXX"
  },
  "operations_team": {
    "regional_manager": "Marta Aguirre",
    "control_center": "Bilbao COE",
    "maintenance_contractor": "Vestas Eólica SAU"
  },
  "parks": [
    {
      "park_id": "ESGALCM002",
      "name": "Costa da Morte",
      "region": "Galicia",
      "capacity_mw": 10.0,
      "turbines": 5,
      "status": "operational"
    }
  ],
  "total_installed_capacity_mw": 10.0,
  "total_turbines": 5,
  "future_parks_out_of_scope": ["ESCLEBA015", "ESARAHU009"]
}
```

### `_informational` — Agregación operativa nacional (bubble-up)

```
uns/v1/GALERNA_ENERGY/SPAIN/_informational
```

MQTT: `retained=false` · Almacenamiento: TimescaleDB · Frecuencia: cada 15 min

```json
{
  "timestamp": "2016-01-01T00:15:00+00:00",
  "aggregation_window": "15min",
  "site_total_active_power_kw": 74668.0,
  "site_capacity_factor": 0.311,
  "site_availability": 0.800,
  "site_turbines_producing": 4,
  "site_turbines_total": 5,
  "site_avg_wind_speed_ms": 4.15,
  "site_total_energy_kwh_today": 12445.0,
  "grid_frequency_avg_hz": 50.01,
  "parks_summary": [
    {
      "park_id": "ESGALCM002",
      "active_power_kw": 74668.0,
      "availability": 0.800,
      "turbines_producing": 4,
      "avg_wind_speed_ms": 4.15
    }
  ]
}
```

### `_analytical` — Umbrales regulatorios y scoring regional

```
uns/v1/GALERNA_ENERGY/SPAIN/_analytical
```

MQTT: `retained=true` · Almacenamiento: PostgreSQL (versionado) · Frecuencia de cambio: anual/regulatoria

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00",
  "version": 1,
  "regulatory_compliance": {
    "grid_code": "P.O. 12.2 REE",
    "reactive_power_requirements": {
      "cos_phi_min": 0.98,
      "cos_phi_max": 1.0,
      "voltage_regulation_band_pct": 5
    },
    "frequency_ride_through": {
      "min_hz": 47.5,
      "max_hz": 51.5,
      "duration_seconds": 60
    },
    "curtailment_authority": "REE CECOEL"
  },
  "site_performance_targets": {
    "availability_target": 0.96,
    "capacity_factor_target": 0.27,
    "annual_production_target_mwh": 30500
  },
  "site_health_score": {
    "value": 0.91,
    "confidence": 0.88,
    "calculated_at": "2016-01-01T00:00:00+00:00"
  },
  "maintenance_kpis": {
    "planned_maintenance_window": "mar-abr, sep-oct",
    "avg_mtbf_hours": 2800,
    "avg_mttr_hours": 36
  }
}
```

---

## 3. Area — GALICIA_COSTA_MORTE (ESGALCM002)

### Topic base
```
uns/v1/GALERNA_ENERGY/SPAIN/GALICIA_COSTA_MORTE/
```

### `_descriptive` — Identidad del parque y configuración física

```
uns/v1/GALERNA_ENERGY/SPAIN/GALICIA_COSTA_MORTE/_descriptive
```

MQTT: `retained=true` · Almacenamiento: PostgreSQL · Frecuencia de cambio: muy baja

```json
{
  "schema_version": "1.0.0",
  "park_id": "ESGALCM002",
  "park_name": "Parque Eólico Costa da Morte",
  "area_name": "GALICIA_COSTA_MORTE",
  "region": "Galicia",
  "province": "A Coruña",
  "municipality": "Camariñas",
  "coordinates": {
    "center": { "lat": 43.1275, "lon": -9.1789 },
    "altitude_m": 380
  },
  "terrain": "coastal_plateau",
  "iec_wind_class": "IEC IIA",
  "commissioning_date": "2012-09-20",
  "environmental_permit": "AAU-2011-0892-AC",
  "grid_connection": {
    "substation": "SET Camariñas 66/20 kV",
    "connection_point": "Nudo Camariñas 66kV",
    "max_export_capacity_mw": 14.0,
    "voltage_kv": 20
  },
  "installed_capacity_mw": 10.0,
  "turbine_model": "Vestas V90-2.0MW",
  "turbine_count": 5,
  "hub_height_m": 80,
  "rotor_diameter_m": 90,
  "turbines": [
    { "id": "T01", "lat": 43.1281, "lon": -9.1812, "elevation_m": 375, "has_scada": true },
    { "id": "T06", "lat": 43.1270, "lon": -9.1765, "elevation_m": 378, "has_scada": true },
    { "id": "T07", "lat": 43.1298, "lon": -9.1778, "elevation_m": 388, "has_scada": true },
    { "id": "T09", "lat": 43.1255, "lon": -9.1798, "elevation_m": 365, "has_scada": false },
    { "id": "T11", "lat": 43.1265, "lon": -9.1801, "elevation_m": 371, "has_scada": true }
  ],
  "meteo_station": {
    "id": "METEO_STATION",
    "lat": 43.1275,
    "lon": -9.1789,
    "height_m": 60,
    "type": "met_mast",
    "sensors": ["anemometer_x2", "wind_vane", "thermometer", "barometer", "hygrometer", "rain_gauge"]
  },
  "maintenance": {
    "contractor": "Vestas Eólica SAU",
    "service_contract": "AOM 5000 Full-Service",
    "contract_expiry": "2027-09-20",
    "nearest_base": "Vimianzo (12 km)"
  },
  "notes": "Turbinas T07, T09 y T11 numeradas según código interno del fabricante, no correlativas. T09 sin exportación SCADA en dataset 2016."
}
```

### `_informational` — Estado operativo del parque en tiempo real (bubble-up)

```
uns/v1/GALERNA_ENERGY/SPAIN/GALICIA_COSTA_MORTE/_informational
```

MQTT: `retained=false` · Almacenamiento: TimescaleDB · Frecuencia: cada 10 min (agregación desde turbinas)

```json
{
  "timestamp": "2016-01-01T00:10:00+00:00",
  "aggregation_window": "10min",
  "park_total_active_power_kw": 74668.0,
  "park_installed_capacity_kw": 10000,
  "park_capacity_factor": 0.311,
  "park_availability": 0.800,
  "park_turbines_producing": 4,
  "park_turbines_total": 5,
  "park_turbines_standby": 0,
  "park_turbines_faulted": 0,
  "park_turbines_maintenance": 0,
  "park_turbines_no_scada": 1,
  "park_avg_wind_speed_ms": 4.15,
  "park_avg_ambient_temp_c": 18,
  "park_total_energy_kwh_today": 12445.0,
  "park_reactive_power_total_kvar": -43768,
  "park_avg_grid_frequency_hz": 50.0,
  "park_avg_cos_phi": 0.75,
  "meteo_reference": {
    "wind_speed_avg_ms": 3.2,
    "wind_direction_avg_deg": 236,
    "ambient_temp_c": 30,
    "pressure_hpa": 1010,
    "humidity_pct": 38,
    "precipitation": false
  },
  "turbine_status": [
    { "id": "T01", "state": "producing", "power_kw": 4313.0, "wind_ms": 3.3 },
    { "id": "T06", "state": "producing", "power_kw": 10465.0, "wind_ms": 3.8 },
    { "id": "T07", "state": "producing", "power_kw": 18831.0, "wind_ms": 4.1 },
    { "id": "T09", "state": "no_scada", "power_kw": null, "wind_ms": null },
    { "id": "T11", "state": "producing", "power_kw": 41059.0, "wind_ms": 5.3 }
  ]
}
```

### `_analytical` — Rendimiento, umbrales y scoring del parque

```
uns/v1/GALERNA_ENERGY/SPAIN/GALICIA_COSTA_MORTE/_analytical
```

MQTT: `retained=true` · Almacenamiento: PostgreSQL (config versionada) + TimescaleDB (resultados temporales) · Frecuencia de cambio: mensual (revisión) / en tiempo real (scores)

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00",
  "version": 4,
  "performance_targets": {
    "annual_availability_target": 0.97,
    "annual_capacity_factor_target": 0.29,
    "annual_production_target_mwh": 30500,
    "annual_equivalent_hours": 2540,
    "max_curtailment_hours_year": 200
  },
  "park_thresholds": {
    "min_turbines_producing_for_normal": 4,
    "max_concurrent_faults_before_alarm": 2,
    "wind_speed_cut_in_ms": 3.5,
    "wind_speed_cut_out_ms": 25.0,
    "wind_speed_rated_ms": 12.0
  },
  "grid_compliance": {
    "voltage_deviation_max_pct": 5,
    "frequency_range_hz": [49.5, 50.5],
    "cos_phi_target": 0.98,
    "reactive_power_setpoint_kvar": 0
  },
  "park_health_score": {
    "value": 0.84,
    "confidence": 0.90,
    "calculated_at": "2016-01-01T00:00:00+00:00",
    "model": "weighted_component_health_v2",
    "breakdown": {
      "T01": 0.91,
      "T06": 0.72,
      "T07": 0.85,
      "T09": null,
      "T11": 0.88
    }
  },
  "wake_effect_model": {
    "enabled": true,
    "primary_direction_deg": 220,
    "affected_pairs": [
      { "upstream": "T01", "downstream": "T07", "loss_pct_estimated": 8.2 },
      { "upstream": "T06", "downstream": "T11", "loss_pct_estimated": 5.1 }
    ]
  },
  "failure_statistics": {
    "period": "2016-01-01/2016-12-31",
    "total_events": 16,
    "by_component": {
      "GENERATOR": 6,
      "GENERATOR_BEARING": 4,
      "GEARBOX": 2,
      "HYDRAULIC_GROUP": 2,
      "TRANSFORMER": 2
    },
    "most_affected_turbine": "T06",
    "mtbf_hours_estimated": 1920,
    "mttr_hours_estimated": 42
  }
}
```

---

## Relación jerárquica y flujo de datos

```
GALERNA_ENERGY (Enterprise)
│  _descriptive: identidad corporativa, estructura de flota
│  _informational: KPIs agregados de toda la flota (bubble-up cada 15 min)
│  _analytical: objetivos anuales, política de escalación, health score global
│
├── SPAIN (Site)
│   │  _descriptive: contexto regulatorio, equipos regionales, listado de parques
│   │  _informational: producción nacional agregada (bubble-up cada 15 min)
│   │  _analytical: cumplimiento normativo REE, objetivos regionales, MTBF/MTTR
│   │
│   ├── GALICIA_COSTA_MORTE (Area = Parque ESGALCM002)
│   │   │  _descriptive: identidad del parque, configuración física, contrato de mantenimiento
│   │   │  _informational: estado operativo del parque, resumen de turbinas, meteo de referencia
│   │   │  _analytical: umbrales operativos, health score por turbina, wake effect, estadísticas de fallos
│   │   │
│   │   ├── T01/ (Equipment)
│   │   ├── T06/ (Equipment)
│   │   ├── T07/ (Equipment)
│   │   ├── T09/ (Equipment — sin SCADA, solo logbook)
│   │   ├── T11/ (Equipment)
│   │   └── METEO_STATION/ (Equipment — recurso compartido)
│   │
│   ├── CASTILLA_LEON_BABIA (Area = Parque ESCLEBA015 — futuro / fuera de alcance MVP)
│   └── ARAGON_ALCUBIERRE (Area = Parque ESARAHU009 — futuro / fuera de alcance MVP)
│
└── PORTUGAL (Site — futuro / fuera de alcance MVP)
    └── ALENTEJO_ALENTEJANO (Area = Parque PTALEAL003 — futuro / fuera de alcance MVP)
```

---

## Notas de diseño

### Estado de T02-T05 en el MVP

En este contract freeze v1, T02-T05 no forman parte del inventario operativo activo del MVP. Se reservan explicitamente como activos futuros/fuera de alcance y no aparecen en payloads operativos (`_informational`) ni en agregados activos del parque.

### MeteoStation como Equipment a nivel Area

La estación meteorológica no pertenece a ninguna turbina — mide las condiciones de referencia del parque. Se posiciona como equipment hijo directo de Area, al mismo nivel que las turbinas, pero su `_informational` alimenta el campo `meteo_reference` del `_informational` agregado del parque.

### Bubble-up: quién calcula qué

Los `_informational` de Enterprise, Site y Area no son queries a topics hijos en tiempo de lectura. Son publicados por un **servicio de agregación dedicado** que se suscribe a los `_informational` de los hijos, calcula los agregados, y publica en el topic padre. Esto es fundamental — cada nivel tiene su propia frecuencia de agregación y su propia lógica de cálculo.

### Coherencia de los datos inventados

Los valores del `_informational` de Area están tomados directamente de la primera fila del SCADA CSV (2016-01-01T00:00:00): T01 produce 4313 kW a 3.3 m/s, T06 produce 10465 kW, T07 produce 18831 kW, T11 produce 41059 kW y T09 queda como `no_scada`. Los datos del MetMast (30°C, 236° dirección, 3.2 m/s) corresponden a la primera fila del CSV meteorológico. Las estadísticas de fallos en `_analytical` son un conteo exacto de las 16 filas del Failure Logbook.

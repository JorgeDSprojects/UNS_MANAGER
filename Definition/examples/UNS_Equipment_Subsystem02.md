# UNS Definitions — Equipment & Subsystem

## Convención de este documento

- **T01** se define como **referencia canónica** — Equipment completo + todos sus Subsystems con los tres payloads
- **T06** se define como **variante problemática** — solo se documentan las diferencias respecto a T01 (historial de fallos extenso, health scores degradados)
- **T07, T11** siguen la misma estructura que T01 — se documentan solo sus valores `_analytical` diferenciados por historial de fallos
- **T09** se define como **caso especial** — Equipment sin SCADA, solo metadata y eventos del logbook
- **METEO_STATION** se define completa — estructura de subsystems distinta a las turbinas
- Los valores de `_informational` están tomados de la primera fila de cada turbina en `scada_peque.csv` (2016-01-01T00:00:00+00:00)
- Los eventos de `_analytical` provienen del `Historical-Failure-Logbook-2016.csv`

### Cambios respecto a la versión anterior

- **`signals` cambia de array a objeto** — clave = nombre de señal, valor = propiedades
- **Se elimina `aggregation`** — era redundante con el sufijo del nombre (_Avg, _Max, _Min, _Std)
- **Se añaden `range_min` y `range_max`** — rango operativo esperado (basado en datos reales + margen)
- **Se añade `default_chart`** — tipo de gráfica recomendada para visualización en dashboards SCADA

### Tipos de gráfica disponibles (`default_chart.type`)

| Tipo | Uso |
|---|---|
| `time_series` | Evolución temporal de la señal (la mayoría) |
| `gauge` | Valores instantáneos con rango acotado (cos phi, frecuencia) |
| `wind_rose` | Distribución direccional del viento |
| `scatter` | Correlación entre dos variables (potencia vs viento) |
| `histogram` | Distribución de valores (ángulos de pitch) |
| `bar` | Comparación entre equipos o canales |

---

## T01 — Referencia canónica

### Equipment: T01

#### Topic base
```
uns/v1/GALERNA_ENERGY/SPAIN/GALICIA_COSTA_MORTE/T01/
```

#### `_descriptive` — Identidad del activo

```
uns/v1/GALERNA_ENERGY/SPAIN/GALICIA_COSTA_MORTE/T01/_descriptive
```

MQTT: `retained=true` · PostgreSQL · Cambio: muy bajo

```json
{
  "schema_version": "1.0.0",
  "equipment_id": "T01",
  "equipment_type": "wind_turbine",
  "manufacturer": "Vestas",
  "model": "V90-2.0MW",
  "serial_number": "VES-V90-2012-CM-001",
  "rated_power_kw": 2000,
  "hub_height_m": 80,
  "rotor_diameter_m": 90,
  "swept_area_m2": 6362,
  "commissioning_date": "2012-09-20",
  "coordinates": { "lat": 43.1281, "lon": -9.1812 },
  "elevation_m": 375,
  "orientation_predominant_deg": 220,
  "controller_firmware": "VCS-9.4.2",
  "scada_available": true,
  "subsystems": [
    "GENERATOR", "GEARBOX", "HYDRAULIC", "ROTOR", "BLADES",
    "NACELLE", "AMBIENT", "GRID_CONNECTION", "HV_TRANSFORMER",
    "INVERTER", "CONTROLLER", "POWER_OUTPUT"
  ],
  "operational_parameters": {
    "cut_in_wind_speed_ms": 3.5,
    "cut_out_wind_speed_ms": 25.0,
    "rated_wind_speed_ms": 12.0,
    "survival_wind_speed_ms": 52.5,
    "rotor_speed_range_rpm": [9.0, 14.9],
    "generator_speed_range_rpm": [1000, 1500],
    "gear_ratio": 112.8
  }
}
```

#### `_informational` — Estado operativo de la turbina (bubble-up desde subsystems)

```
uns/v1/GALERNA_ENERGY/SPAIN/GALICIA_COSTA_MORTE/T01/_informational
```

MQTT: retained=false · TimescaleDB · Frecuencia: cada ciclo de muestreo (agregación)

```json
{
  "timestamp": "2016-01-01T00:00:00+00:00",
  "operating_state": "producing",
  "total_active_power_kw": 4313.0,
  "total_reactive_power_kvar": -5735,
  "capacity_utilization_pct": 21.6,
  "wind_speed_avg_ms": 3.3,
  "ambient_temp_c": 18,
  "nacelle_direction_deg": 218.5,
  "yaw_error_deg": -12.4,
  "rotor_rpm_avg": 11.1,
  "generator_rpm_avg": 1249.0,
  "pitch_angle_avg_deg": 0.6,
  "grid_frequency_hz": 50.0,
  "thermal_summary": {
    "max_component_temp_c": 76,
    "max_component": "HVTrafo_Phase2",
    "ambient_delta_c": 58
  }
}
```

#### `_analytical` — Health score y umbrales del equipo

```
uns/v1/GALERNA_ENERGY/SPAIN/GALICIA_COSTA_MORTE/T01/_analytical
```

MQTT: `retained=true` · PostgreSQL (versionado) + TimescaleDB (scores temporales) · Cambio: mensual

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00",
  "version": 3,
  "health_score": {
    "value": 0.91, "confidence": 0.88,
    "calculated_at": "2016-01-01T00:00:00+00:00",
    "model": "weighted_component_health_v2",
    "component_scores": {
      "GENERATOR": 0.95, "GEARBOX": 0.82, "HYDRAULIC": 0.96,
      "ROTOR": 0.94, "BLADES": 0.93, "HV_TRANSFORMER": 0.90,
      "INVERTER": 0.92, "GRID_CONNECTION": 0.94
    }
  },
  "operating_state_thresholds": {
    "producing_min_power_kw": 10,
    "idle_max_power_kw": 10,
    "fault_conditions": ["any_alarm_active", "emergency_stop"]
  },
  "failure_history_summary": {
    "period": "2016-01-01/2016-12-31",
    "total_events": 1,
    "events": [
      { "timestamp": "2016-07-18T02:10:00+00:00", "component": "GEARBOX", "remarks": "Gearbox pump damaged", "severity": "major" }
    ],
    "mtbf_hours_estimated": 4380,
    "mttr_hours_estimated": 24
  }
}
```

---

### Subsystem: T01 / GENERATOR

#### Topic base
```
uns/v1/GALERNA_ENERGY/SPAIN/GALICIA_COSTA_MORTE/T01/GENERATOR/
```

#### `_descriptive`

```
uns/v1/GALERNA_ENERGY/SPAIN/GALICIA_COSTA_MORTE/T01/GENERATOR/_descriptive
```

```json
{
  "schema_version": "1.0.0",
  "subsystem_id": "GENERATOR",
  "subsystem_type": "doubly_fed_induction_generator",
  "manufacturer": "Vestas",
  "rated_power_kw": 2000,
  "voltage_v": 690,
  "frequency_hz": 50,
  "pole_pairs": 2,
  "cooling_type": "forced_air",
  "bearing_count": 2,
  "has_slip_ring": true,
  "signals": {
    "Gen_RPM_Max": { "unit": "RPM", "data_type": "float", "range_min": 0, "range_max": 1800, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Gen_RPM_Min": { "unit": "RPM", "data_type": "float", "range_min": 0, "range_max": 1700, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Gen_RPM_Avg": { "unit": "RPM", "data_type": "float", "range_min": 0, "range_max": 1700, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "Gen_RPM_Std": { "unit": "RPM", "data_type": "float", "range_min": 0, "range_max": 600, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Gen_Bear_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 10, "range_max": 100, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "Gen_Bear2_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 10, "range_max": 100, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "Gen_Phase1_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 15, "range_max": 130, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "Gen_Phase2_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 15, "range_max": 130, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "Gen_Phase3_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 15, "range_max": 130, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "Gen_SlipRing_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 10, "range_max": 100, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } }
  }
}
```

#### `_informational`

```json
{
  "timestamp": "2016-01-01T00:00:00+00:00",
  "Gen_RPM_Max": 1277.4, "Gen_RPM_Min": 1226.1, "Gen_RPM_Avg": 1249.0, "Gen_RPM_Std": 9.0,
  "Gen_Bear_Temp_Avg": 41, "Gen_Bear2_Temp_Avg": 37,
  "Gen_Phase1_Temp_Avg": 58, "Gen_Phase2_Temp_Avg": 59, "Gen_Phase3_Temp_Avg": 58,
  "Gen_SlipRing_Temp_Avg": 25
}
```

#### `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00",
  "version": 2,
  "thresholds": {
    "Gen_RPM_Avg": { "warning_low": 950, "alarm_low": 900, "warning_high": 1400, "alarm_high": 1500, "unit": "RPM" },
    "Gen_Bear_Temp_Avg": { "warning_high": 65, "alarm_high": 80, "unit": "°C" },
    "Gen_Bear2_Temp_Avg": { "warning_high": 65, "alarm_high": 80, "unit": "°C" },
    "Gen_Phase1_Temp_Avg": { "warning_high": 85, "alarm_high": 100, "unit": "°C" },
    "Gen_Phase2_Temp_Avg": { "warning_high": 85, "alarm_high": 100, "unit": "°C" },
    "Gen_Phase3_Temp_Avg": { "warning_high": 85, "alarm_high": 100, "unit": "°C" },
    "Gen_SlipRing_Temp_Avg": { "warning_high": 70, "alarm_high": 90, "unit": "°C" },
    "phase_imbalance_max_delta_c": { "warning": 5, "alarm": 10, "description": "Max difference between any two phase temperatures" }
  },
  "health_score": { "value": 0.95, "confidence": 0.90, "calculated_at": "2016-01-01T00:00:00+00:00" },
  "failure_events": []
}
```

---

### Subsystem: T01 / GEARBOX

#### `_descriptive`

```json
{
  "schema_version": "1.0.0",
  "subsystem_id": "GEARBOX",
  "subsystem_type": "planetary_helical_3stage",
  "manufacturer": "Hansen Transmissions",
  "gear_ratio": 112.8,
  "oil_type": "Mobil SHC 629",
  "oil_capacity_liters": 280,
  "cooling_type": "oil_cooler_forced",
  "signals": {
    "Gear_Oil_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 0, "range_max": 80, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "Gear_Bear_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 0, "range_max": 90, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } }
  }
}
```

#### `_informational`

```json
{
  "timestamp": "2016-01-01T00:00:00+00:00",
  "Gear_Oil_Temp_Avg": 44,
  "Gear_Bear_Temp_Avg": 48
}
```

#### `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00",
  "version": 2,
  "thresholds": {
    "Gear_Oil_Temp_Avg": { "warning_high": 65, "alarm_high": 75, "warning_low": 10, "alarm_low": 0, "unit": "°C", "note": "Oil viscosity degrades above 75°C; below 10°C requires pre-heating" },
    "Gear_Bear_Temp_Avg": { "warning_high": 70, "alarm_high": 85, "unit": "°C" },
    "oil_temp_minus_ambient_delta": { "warning_high": 45, "alarm_high": 55, "description": "Gear oil temp minus ambient — cooling system efficiency indicator" }
  },
  "health_score": { "value": 0.82, "confidence": 0.85, "calculated_at": "2016-01-01T00:00:00+00:00", "note": "Score impacted by upcoming failure 2016-07-18" },
  "failure_events": [
    { "timestamp": "2016-07-18T02:10:00+00:00", "remarks": "Gearbox pump damaged", "severity": "major", "downtime_hours_estimated": 24 }
  ]
}
```

---

### Subsystem: T01 / HYDRAULIC

#### `_descriptive`

```json
{
  "schema_version": "1.0.0",
  "subsystem_id": "HYDRAULIC",
  "subsystem_type": "pitch_yaw_hydraulic_system",
  "functions": ["pitch_regulation", "yaw_drive", "rotor_brake"],
  "oil_type": "Shell Tellus S2 MX 46",
  "oil_capacity_liters": 120,
  "pump_type": "axial_piston",
  "operating_pressure_bar": 200,
  "signals": {
    "Hyd_Oil_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": -10, "range_max": 70, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } }
  }
}
```

#### `_informational`

```json
{ "timestamp": "2016-01-01T00:00:00+00:00", "Hyd_Oil_Temp_Avg": 30 }
```

#### `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00", "version": 1,
  "thresholds": { "Hyd_Oil_Temp_Avg": { "warning_high": 55, "alarm_high": 65, "warning_low": 5, "alarm_low": -5, "unit": "°C" } },
  "health_score": { "value": 0.96, "confidence": 0.88 },
  "failure_events": []
}
```

---

### Subsystem: T01 / ROTOR

#### `_descriptive`

```json
{
  "schema_version": "1.0.0",
  "subsystem_id": "ROTOR",
  "subsystem_type": "three_blade_upwind",
  "diameter_m": 90, "swept_area_m2": 6362,
  "speed_range_rpm": [9.0, 14.9],
  "regulation": "variable_speed_pitch_regulated",
  "signals": {
    "Rtr_RPM_Max": { "unit": "RPM", "data_type": "float", "range_min": 0, "range_max": 17, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Rtr_RPM_Min": { "unit": "RPM", "data_type": "float", "range_min": 0, "range_max": 16, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Rtr_RPM_Avg": { "unit": "RPM", "data_type": "float", "range_min": 0, "range_max": 16, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "Rtr_RPM_Std": { "unit": "RPM", "data_type": "float", "range_min": 0, "range_max": 6, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } }
  }
}
```

#### `_informational`

```json
{ "timestamp": "2016-01-01T00:00:00+00:00", "Rtr_RPM_Max": 11.3, "Rtr_RPM_Min": 10.9, "Rtr_RPM_Avg": 11.1, "Rtr_RPM_Std": 0.1 }
```

#### `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00", "version": 1,
  "thresholds": { "Rtr_RPM_Avg": { "warning_high": 15.5, "alarm_high": 16.5, "warning_low": 7.0, "alarm_low": 5.0, "unit": "RPM" } },
  "health_score": { "value": 0.94, "confidence": 0.90 },
  "failure_events": []
}
```

---

### Subsystem: T01 / BLADES

#### `_descriptive`

```json
{
  "schema_version": "1.0.0",
  "subsystem_id": "BLADES",
  "blade_count": 3, "blade_length_m": 44,
  "blade_material": "fiberglass_reinforced_epoxy",
  "pitch_system": "hydraulic_individual",
  "pitch_range_deg": [-5, 90], "feather_position_deg": 90,
  "signals": {
    "Blds_PitchAngle_Min": { "unit": "deg", "data_type": "float", "range_min": -5, "range_max": 90, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Blds_PitchAngle_Max": { "unit": "deg", "data_type": "float", "range_min": -5, "range_max": 90, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Blds_PitchAngle_Avg": { "unit": "deg", "data_type": "float", "range_min": -5, "range_max": 90, "default_chart": { "type": "histogram", "show_thresholds": true, "recommended_window": "7d" } },
    "Blds_PitchAngle_Std": { "unit": "deg", "data_type": "float", "range_min": 0, "range_max": 45, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } }
  }
}
```

#### `_informational`

```json
{ "timestamp": "2016-01-01T00:00:00+00:00", "Blds_PitchAngle_Min": -1.1, "Blds_PitchAngle_Max": 4.5, "Blds_PitchAngle_Avg": 0.6, "Blds_PitchAngle_Std": 0.9 }
```

#### `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00", "version": 1,
  "thresholds": {
    "Blds_PitchAngle_Avg": { "parked_indicator_min_deg": 85, "operating_range_deg": [-3, 30], "unit": "deg", "note": "Pitch near 90° + RPM near 0 = parked turbine" },
    "Blds_PitchAngle_Std": { "warning_high": 8.0, "alarm_high": 15.0, "unit": "deg", "note": "High std deviation indicates pitch hunting or control instability" }
  },
  "health_score": { "value": 0.93, "confidence": 0.87 },
  "failure_events": []
}
```

---

### Subsystem: T01 / NACELLE

#### `_descriptive`

```json
{
  "schema_version": "1.0.0",
  "subsystem_id": "NACELLE",
  "yaw_system": "electric_yaw_drives", "yaw_motors": 4,
  "nacelle_weight_tons": 68, "cooling_system": "forced_ventilation",
  "signals": {
    "Nac_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": -15, "range_max": 65, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "Nac_Direction_Avg": { "unit": "deg", "data_type": "float", "range_min": 0, "range_max": 359, "default_chart": { "type": "wind_rose", "show_thresholds": false, "recommended_window": "7d" } },
    "Spin_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": -10, "range_max": 60, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } }
  }
}
```

#### `_informational`

```json
{ "timestamp": "2016-01-01T00:00:00+00:00", "Nac_Temp_Avg": 28, "Nac_Direction_Avg": 218.5, "Spin_Temp_Avg": 20 }
```

#### `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00", "version": 1,
  "thresholds": {
    "Nac_Temp_Avg": { "warning_high": 50, "alarm_high": 60, "warning_low": 0, "alarm_low": -10, "unit": "°C" },
    "Spin_Temp_Avg": { "warning_high": 45, "alarm_high": 55, "unit": "°C" },
    "yaw_error": { "source": "Amb_WindDir_Relative_Avg (in AMBIENT subsystem)", "warning_high_deg": 15, "alarm_high_deg": 25, "note": "Computed as absolute value of relative wind direction. Sustained yaw error indicates yaw system malfunction." }
  },
  "health_score": { "value": 0.94, "confidence": 0.88 },
  "failure_events": []
}
```

---

### Subsystem: T01 / AMBIENT

#### `_descriptive`

```json
{
  "schema_version": "1.0.0",
  "subsystem_id": "AMBIENT",
  "description": "Turbine-local ambient sensors mounted on nacelle",
  "anemometer_type": "ultrasonic",
  "wind_vane_type": "integrated_nacelle",
  "note": "Turbine-local measurements, distinct from METEO_STATION reference data at park level",
  "signals": {
    "Amb_WindSpeed_Max": { "unit": "m/s", "data_type": "float", "range_min": 0, "range_max": 50, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Amb_WindSpeed_Min": { "unit": "m/s", "data_type": "float", "range_min": 0, "range_max": 10, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Amb_WindSpeed_Avg": { "unit": "m/s", "data_type": "float", "range_min": 0, "range_max": 25, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "Amb_WindSpeed_Std": { "unit": "m/s", "data_type": "float", "range_min": 0, "range_max": 5, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Amb_WindSpeed_Est_Avg": { "unit": "m/s", "data_type": "float", "range_min": 0, "range_max": 25, "default_chart": { "type": "scatter", "show_thresholds": false, "recommended_window": "7d", "note": "Best visualized as scatter vs Amb_WindSpeed_Avg to validate NTF" } },
    "Amb_WindDir_Relative_Avg": { "unit": "deg", "data_type": "float", "range_min": -180, "range_max": 180, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h", "note": "Yaw error indicator — values near 0 are optimal" } },
    "Amb_WindDir_Abs_Avg": { "unit": "deg", "data_type": "float", "range_min": 0, "range_max": 359, "default_chart": { "type": "wind_rose", "show_thresholds": false, "recommended_window": "7d" } },
    "Amb_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": -25, "range_max": 50, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "7d" } }
  }
}
```

#### `_informational`

```json
{
  "timestamp": "2016-01-01T00:00:00+00:00",
  "Amb_WindSpeed_Max": 11.6, "Amb_WindSpeed_Min": 0.5, "Amb_WindSpeed_Avg": 3.3, "Amb_WindSpeed_Std": 0.9,
  "Amb_WindSpeed_Est_Avg": 3.6, "Amb_WindDir_Relative_Avg": -12.4, "Amb_WindDir_Abs_Avg": 206.1, "Amb_Temp_Avg": 18
}
```

#### `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00", "version": 1,
  "thresholds": {
    "Amb_WindSpeed_Avg": { "cut_in_ms": 3.5, "rated_ms": 12.0, "cut_out_ms": 25.0, "extreme_ms": 52.5, "unit": "m/s" },
    "Amb_Temp_Avg": { "operating_min_c": -20, "operating_max_c": 45, "unit": "°C" },
    "nacelle_transfer_function": { "description": "Correction curve from nacelle anemometer to free-stream wind speed", "method": "IEC 61400-12-2", "calibration_date": "2015-06-10" }
  },
  "health_score": { "value": 0.97, "confidence": 0.92 },
  "failure_events": []
}
```

---

### Subsystem: T01 / GRID_CONNECTION

Este subsystem tiene sub-agrupaciones lógicas. Se publican como un payload plano (todas las señales en un solo `_informational`) pero se documentan agrupadas para legibilidad.
Para validación en runtime, el keyset canónico de señales se define como la unión de `signal_groups.*.signals` (más `timestamp` en `_informational`).

#### `_descriptive`

```json
{
  "schema_version": "1.0.0",
  "subsystem_id": "GRID_CONNECTION",
  "connection_voltage_kv": 20,
  "grid_code": "P.O. 12.2 REE",
  "signal_groups": {
    "PRODUCTION": {
      "description": "Active and reactive power delivered to grid",
      "signals": {
        "Grd_Prod_Pwr_Avg": { "unit": "kW", "data_type": "float", "range_min": -60, "range_max": 2100, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
        "Grd_Prod_Pwr_Max": { "unit": "kW", "data_type": "float", "range_min": -60, "range_max": 2200, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
        "Grd_Prod_Pwr_Min": { "unit": "kW", "data_type": "float", "range_min": -60, "range_max": 1700, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
        "Grd_Prod_Pwr_Std": { "unit": "kW", "data_type": "float", "range_min": 0, "range_max": 700, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
        "Grd_Prod_CosPhi_Avg": { "unit": "", "data_type": "float", "range_min": 0, "range_max": 1, "default_chart": { "type": "gauge", "show_thresholds": true, "recommended_window": "1h" } },
        "Grd_Prod_Freq_Avg": { "unit": "Hz", "data_type": "float", "range_min": 49, "range_max": 51, "default_chart": { "type": "gauge", "show_thresholds": true, "recommended_window": "1h" } },
        "Grd_Prod_ReactPwr_Avg": { "unit": "kVAr", "data_type": "float", "range_min": -250, "range_max": 100, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
        "Grd_Prod_ReactPwr_Max": { "unit": "kVAr", "data_type": "float", "range_min": -250, "range_max": 1100, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
        "Grd_Prod_ReactPwr_Min": { "unit": "kVAr", "data_type": "float", "range_min": -1000, "range_max": 0, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
        "Grd_Prod_ReactPwr_Std": { "unit": "kVAr", "data_type": "float", "range_min": 0, "range_max": 300, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } }
      }
    },
    "CAPABILITY": {
      "description": "Theoretical max power and reactive capability at current conditions",
      "note": "Sentinel value -1000 in PsbleInd/PsbleCap indicates measurement unavailable",
      "signals": {
        "Grd_Prod_PsblePwr_Avg": { "unit": "kW", "data_type": "float", "range_min": 0, "range_max": 2100, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
        "Grd_Prod_PsblePwr_Max": { "unit": "kW", "data_type": "float", "range_min": 0, "range_max": 2100, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
        "Grd_Prod_PsblePwr_Min": { "unit": "kW", "data_type": "float", "range_min": 0, "range_max": 1700, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
        "Grd_Prod_PsblePwr_Std": { "unit": "kW", "data_type": "float", "range_min": 0, "range_max": 700, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
        "Grd_Prod_PsbleInd_Avg": { "unit": "kVAr", "data_type": "float", "range_min": -1000, "range_max": 0, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
        "Grd_Prod_PsbleInd_Max": { "unit": "kVAr", "data_type": "float", "range_min": -1000, "range_max": 0, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
        "Grd_Prod_PsbleInd_Min": { "unit": "kVAr", "data_type": "float", "range_min": -1000, "range_max": 0, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
        "Grd_Prod_PsbleInd_Std": { "unit": "kVAr", "data_type": "float", "range_min": 0, "range_max": 450, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
        "Grd_Prod_PsbleCap_Avg": { "unit": "kVAr", "data_type": "float", "range_min": 0, "range_max": 1000, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
        "Grd_Prod_PsbleCap_Max": { "unit": "kVAr", "data_type": "float", "range_min": 0, "range_max": 1000, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
        "Grd_Prod_PsbleCap_Min": { "unit": "kVAr", "data_type": "float", "range_min": 0, "range_max": 1000, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
        "Grd_Prod_PsbleCap_Std": { "unit": "kVAr", "data_type": "float", "range_min": 0, "range_max": 450, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } }
      }
    },
    "VOLTAGE": {
      "signals": {
        "Grd_Prod_VoltPhse1_Avg": { "unit": "V", "data_type": "float", "range_min": 380, "range_max": 420, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
        "Grd_Prod_VoltPhse2_Avg": { "unit": "V", "data_type": "float", "range_min": 380, "range_max": 420, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
        "Grd_Prod_VoltPhse3_Avg": { "unit": "V", "data_type": "float", "range_min": 380, "range_max": 420, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } }
      }
    },
    "CURRENT": {
      "signals": {
        "Grd_Prod_CurPhse1_Avg": { "unit": "A", "data_type": "float", "range_min": 0, "range_max": 1800, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
        "Grd_Prod_CurPhse2_Avg": { "unit": "A", "data_type": "float", "range_min": 0, "range_max": 1800, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
        "Grd_Prod_CurPhse3_Avg": { "unit": "A", "data_type": "float", "range_min": 0, "range_max": 1800, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } }
      }
    },
    "BUSBAR": {
      "signals": {
        "Grd_Busbar_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 0, "range_max": 80, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } }
      }
    }
  }
}
```

#### `_informational`

```json
{
  "timestamp": "2016-01-01T00:00:00+00:00",
  "Grd_Prod_Pwr_Avg": 26.2, "Grd_Prod_Pwr_Max": 118.4, "Grd_Prod_Pwr_Min": -33.5, "Grd_Prod_Pwr_Std": 35.3,
  "Grd_Prod_CosPhi_Avg": 0.7, "Grd_Prod_Freq_Avg": 50.0,
  "Grd_Prod_ReactPwr_Avg": -34.9, "Grd_Prod_ReactPwr_Max": 13.2, "Grd_Prod_ReactPwr_Min": -100.0, "Grd_Prod_ReactPwr_Std": 36.2,
  "Grd_Prod_PsblePwr_Avg": 29.4, "Grd_Prod_PsblePwr_Max": 119.3, "Grd_Prod_PsblePwr_Min": 0.0, "Grd_Prod_PsblePwr_Std": 31.9,
  "Grd_Prod_PsbleInd_Avg": -144.4, "Grd_Prod_PsbleInd_Max": 0.0, "Grd_Prod_PsbleInd_Min": -584.5, "Grd_Prod_PsbleInd_Std": 157.1,
  "Grd_Prod_PsbleCap_Avg": 144.4, "Grd_Prod_PsbleCap_Max": 584.5, "Grd_Prod_PsbleCap_Min": 0.0, "Grd_Prod_PsbleCap_Std": 157.1,
  "Grd_Prod_VoltPhse1_Avg": 401.6, "Grd_Prod_VoltPhse2_Avg": 399.9, "Grd_Prod_VoltPhse3_Avg": 399.2,
  "Grd_Prod_CurPhse1_Avg": 46.5, "Grd_Prod_CurPhse2_Avg": 61.1, "Grd_Prod_CurPhse3_Avg": 45.5,
  "Grd_Busbar_Temp_Avg": 38
}
```

#### `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00", "version": 2,
  "thresholds": {
    "Grd_Prod_Freq_Avg": { "warning_low": 49.5, "alarm_low": 49.0, "warning_high": 50.5, "alarm_high": 51.0, "unit": "Hz" },
    "Grd_Prod_CosPhi_Avg": { "warning_low": 0.95, "alarm_low": 0.90, "unit": "", "note": "REE P.O. 12.2 requires cos_phi >= 0.98 at PCC" },
    "Grd_Busbar_Temp_Avg": { "warning_high": 55, "alarm_high": 70, "unit": "°C" },
    "voltage_imbalance_max_delta_v": { "warning": 5.0, "alarm": 10.0, "description": "Max difference between any two phase voltages" },
    "current_imbalance_max_delta_a": { "warning": 20.0, "alarm": 40.0, "description": "Max difference between any two phase currents" }
  },
  "health_score": { "value": 0.94, "confidence": 0.89 },
  "failure_events": []
}
```

---

### Subsystem: T01 / HV_TRANSFORMER

#### `_descriptive`

```json
{
  "schema_version": "1.0.0",
  "subsystem_id": "HV_TRANSFORMER",
  "transformer_type": "dry_type_cast_resin",
  "voltage_ratio": "0.69/20 kV",
  "rated_power_kva": 2200,
  "cooling_type": "AN/AF",
  "location": "tower_base",
  "signals": {
    "HVTrafo_Phase1_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 20, "range_max": 140, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "HVTrafo_Phase2_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 20, "range_max": 140, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "HVTrafo_Phase3_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 20, "range_max": 140, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } }
  }
}
```

#### `_informational`

```json
{ "timestamp": "2016-01-01T00:00:00+00:00", "HVTrafo_Phase1_Temp_Avg": 68, "HVTrafo_Phase2_Temp_Avg": 76, "HVTrafo_Phase3_Temp_Avg": 65 }
```

#### `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00", "version": 1,
  "thresholds": {
    "HVTrafo_Phase1_Temp_Avg": { "warning_high": 100, "alarm_high": 120, "unit": "°C" },
    "HVTrafo_Phase2_Temp_Avg": { "warning_high": 100, "alarm_high": 120, "unit": "°C" },
    "HVTrafo_Phase3_Temp_Avg": { "warning_high": 100, "alarm_high": 120, "unit": "°C" },
    "phase_imbalance_max_delta_c": { "warning": 10, "alarm": 20 }
  },
  "health_score": { "value": 0.90, "confidence": 0.86 },
  "failure_events": []
}
```

---

### Subsystem: T01 / INVERTER

#### `_descriptive`

```json
{
  "schema_version": "1.0.0",
  "subsystem_id": "INVERTER",
  "inverter_type": "back_to_back_IGBT",
  "topology": "rotor_side_and_grid_side",
  "cooling_type": "liquid_cooled",
  "note": "Grid-side inverter only reports Phase 1 temperature. Rotor-side reports all 3 phases.",
  "signals": {
    "Grd_InverterPhase1_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 15, "range_max": 75, "side": "grid", "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "Grd_RtrInvPhase1_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 15, "range_max": 75, "side": "rotor", "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "Grd_RtrInvPhase2_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 15, "range_max": 75, "side": "rotor", "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "Grd_RtrInvPhase3_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 15, "range_max": 75, "side": "rotor", "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } }
  }
}
```

#### `_informational`

```json
{ "timestamp": "2016-01-01T00:00:00+00:00", "Grd_InverterPhase1_Temp_Avg": 39, "Grd_RtrInvPhase1_Temp_Avg": 39, "Grd_RtrInvPhase2_Temp_Avg": 39, "Grd_RtrInvPhase3_Temp_Avg": 38 }
```

#### `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00", "version": 1,
  "thresholds": {
    "Grd_InverterPhase1_Temp_Avg": { "warning_high": 55, "alarm_high": 70, "unit": "°C" },
    "Grd_RtrInvPhase1_Temp_Avg": { "warning_high": 55, "alarm_high": 70, "unit": "°C" },
    "Grd_RtrInvPhase2_Temp_Avg": { "warning_high": 55, "alarm_high": 70, "unit": "°C" },
    "Grd_RtrInvPhase3_Temp_Avg": { "warning_high": 55, "alarm_high": 70, "unit": "°C" },
    "rotor_inv_phase_imbalance_max_delta_c": { "warning": 5, "alarm": 10 }
  },
  "health_score": { "value": 0.92, "confidence": 0.88 },
  "failure_events": []
}
```

---

### Subsystem: T01 / CONTROLLER

#### `_descriptive`

```json
{
  "schema_version": "1.0.0",
  "subsystem_id": "CONTROLLER",
  "controller_type": "VCS_Vestas_Central_System",
  "firmware_version": "VCS-9.4.2",
  "cabinets": {
    "top": "nacelle main controller cabinet",
    "hub": "hub/spinner controller",
    "vcp": "Vestas Converter Panel — power converter control with liquid cooling"
  },
  "signals": {
    "Cont_Top_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 10, "range_max": 65, "location": "nacelle", "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "Cont_Hub_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 10, "range_max": 65, "location": "hub", "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "Cont_VCP_Temp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 15, "range_max": 70, "location": "nacelle", "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "Cont_VCP_ChokcoilTemp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 15, "range_max": 140, "location": "nacelle", "note": "Choke coils operate at 70-110°C by design", "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "Cont_VCP_WtrTemp_Avg": { "unit": "°C", "data_type": "integer", "range_min": 10, "range_max": 65, "location": "nacelle", "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } }
  }
}
```

#### `_informational`

```json
{ "timestamp": "2016-01-01T00:00:00+00:00", "Cont_Top_Temp_Avg": 39, "Cont_Hub_Temp_Avg": 28, "Cont_VCP_Temp_Avg": 43, "Cont_VCP_ChokcoilTemp_Avg": 91, "Cont_VCP_WtrTemp_Avg": 39 }
```

#### `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00", "version": 1,
  "thresholds": {
    "Cont_Top_Temp_Avg": { "warning_high": 50, "alarm_high": 60, "unit": "°C" },
    "Cont_Hub_Temp_Avg": { "warning_high": 50, "alarm_high": 60, "unit": "°C" },
    "Cont_VCP_Temp_Avg": { "warning_high": 55, "alarm_high": 65, "unit": "°C" },
    "Cont_VCP_ChokcoilTemp_Avg": { "warning_high": 110, "alarm_high": 130, "unit": "°C", "note": "Choke coils operate at higher temps by design" },
    "Cont_VCP_WtrTemp_Avg": { "warning_high": 50, "alarm_high": 60, "unit": "°C", "note": "Cooling water circuit — high temp indicates pump/radiator issue" }
  },
  "health_score": { "value": 0.93, "confidence": 0.87 },
  "failure_events": []
}
```

---

### Subsystem: T01 / POWER_OUTPUT

#### `_descriptive`

```json
{
  "schema_version": "1.0.0",
  "subsystem_id": "POWER_OUTPUT",
  "description": "Aggregated production signals from internal generator channels — distinct from grid-metered signals in GRID_CONNECTION",
  "channels": { "Gen0": "Main generator power measurement (stator)", "Gen1": "Rotor-side power measurement (through converter)", "Gen2": "Auxiliary/redundant measurement channel" },
  "note": "TotActPwr = Gen0 + Gen1 + Gen2. Negative values indicate power import during motoring/startup.",
  "signals": {
    "Prod_LatestAvg_ActPwrGen0": { "unit": "W", "data_type": "integer", "range_min": -5000, "range_max": 500, "default_chart": { "type": "bar", "show_thresholds": false, "recommended_window": "1h", "note": "Best viewed as stacked bar with Gen1 and Gen2" } },
    "Prod_LatestAvg_ActPwrGen1": { "unit": "W", "data_type": "float", "range_min": -500, "range_max": 350000, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Prod_LatestAvg_ActPwrGen2": { "unit": "W", "data_type": "integer", "range_min": 0, "range_max": 100, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Prod_LatestAvg_TotActPwr": { "unit": "W", "data_type": "float", "range_min": -5000, "range_max": 350000, "default_chart": { "type": "scatter", "show_thresholds": true, "recommended_window": "7d", "note": "Best as scatter vs wind speed (power curve)" } },
    "Prod_LatestAvg_ReactPwrGen0": { "unit": "VAr", "data_type": "integer", "range_min": -2500, "range_max": 300, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Prod_LatestAvg_ReactPwrGen1": { "unit": "VAr", "data_type": "integer", "range_min": -40000, "range_max": 16000, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Prod_LatestAvg_ReactPwrGen2": { "unit": "VAr", "data_type": "integer", "range_min": 0, "range_max": 100, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Prod_LatestAvg_TotReactPwr": { "unit": "VAr", "data_type": "integer", "range_min": -40000, "range_max": 16000, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } }
  }
}
```

#### `_informational`

```json
{
  "timestamp": "2016-01-01T00:00:00+00:00",
  "Prod_LatestAvg_ActPwrGen0": -107, "Prod_LatestAvg_ActPwrGen1": 4420.0, "Prod_LatestAvg_ActPwrGen2": 0, "Prod_LatestAvg_TotActPwr": 4313.0,
  "Prod_LatestAvg_ReactPwrGen0": -99, "Prod_LatestAvg_ReactPwrGen1": -5636, "Prod_LatestAvg_ReactPwrGen2": 0, "Prod_LatestAvg_TotReactPwr": -5735
}
```

#### `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00", "version": 1,
  "thresholds": {
    "Prod_LatestAvg_TotActPwr": { "rated_w": 2000000, "negative_warning_w": -50000, "note": "Sustained negative total power may indicate parasitic load or metering error" },
    "channel_consistency": { "description": "Gen0 + Gen1 + Gen2 should equal TotActPwr within tolerance", "tolerance_w": 500 }
  },
  "health_score": { "value": 0.95, "confidence": 0.90 },
  "failure_events": []
}
```

---

---

## T06 — Variante problemática (solo diferencias vs T01)

T06 comparte la misma estructura de subsystems que T01. Solo se documentan los payloads que difieren significativamente.

### Equipment: T06 / `_descriptive`

```
uns/v1/GALERNA_ENERGY/SPAIN/GALICIA_COSTA_MORTE/T06/_descriptive
```

Idéntico a T01 excepto:

```json
{
  "equipment_id": "T06",
  "serial_number": "VES-V90-2012-CM-006",
  "coordinates": { "lat": 43.1270, "lon": -9.1765 },
  "elevation_m": 378,
  "notes": "Turbine with highest failure rate in 2016. Generator replaced twice (Jul, Oct). Refrigeration system replaced (Oct)."
}
```

### Equipment: T06 / `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00", "version": 5,
  "health_score": {
    "value": 0.72, "confidence": 0.92, "calculated_at": "2016-01-01T00:00:00+00:00",
    "component_scores": { "GENERATOR": 0.48, "GEARBOX": 0.94, "HYDRAULIC": 0.78, "ROTOR": 0.93, "BLADES": 0.91, "HV_TRANSFORMER": 0.88, "INVERTER": 0.90, "GRID_CONNECTION": 0.92 }
  },
  "failure_history_summary": {
    "period": "2016-01-01/2016-12-31", "total_events": 6,
    "events": [
      { "timestamp": "2016-04-04T18:53:00+00:00", "component": "HYDRAULIC_GROUP", "remarks": "Error in pitch regulation", "severity": "moderate" },
      { "timestamp": "2016-07-11T19:48:00+00:00", "component": "GENERATOR", "remarks": "Generator replaced", "severity": "critical" },
      { "timestamp": "2016-07-24T17:01:00+00:00", "component": "GENERATOR", "remarks": "Generator temperature sensor failure", "severity": "moderate" },
      { "timestamp": "2016-09-04T08:08:00+00:00", "component": "GENERATOR", "remarks": "High temperature generator error", "severity": "major" },
      { "timestamp": "2016-10-02T17:08:00+00:00", "component": "GENERATOR", "remarks": "Refrigeration system and temperature sensors in generator replaced", "severity": "critical" },
      { "timestamp": "2016-10-27T16:26:00+00:00", "component": "GENERATOR", "remarks": "Generator replaced", "severity": "critical" }
    ],
    "mtbf_hours_estimated": 730, "mttr_hours_estimated": 56
  }
}
```

### Subsystem: T06 / GENERATOR / `_analytical`

La diferencia principal — health score devastado por 5 eventos en el generador:

```json
{
  "effective_since": "2016-10-27T16:26:00+00:00", "version": 6,
  "thresholds": {
    "Gen_Bear_Temp_Avg": { "warning_high": 55, "alarm_high": 70, "unit": "°C", "note": "Thresholds lowered post-incident — two generator replacements suggest systematic thermal issue" },
    "Gen_Phase1_Temp_Avg": { "warning_high": 75, "alarm_high": 90, "unit": "°C" },
    "Gen_Phase2_Temp_Avg": { "warning_high": 75, "alarm_high": 90, "unit": "°C" },
    "Gen_Phase3_Temp_Avg": { "warning_high": 75, "alarm_high": 90, "unit": "°C" },
    "Gen_SlipRing_Temp_Avg": { "warning_high": 60, "alarm_high": 80, "unit": "°C" },
    "phase_imbalance_max_delta_c": { "warning": 3, "alarm": 7, "note": "Tightened after repeated thermal failures" }
  },
  "health_score": { "value": 0.48, "confidence": 0.94, "calculated_at": "2016-10-27T16:26:00+00:00", "note": "Two generator replacements + sensor/refrigeration failures in 4 months. Root cause investigation ongoing." },
  "failure_events": [
    { "timestamp": "2016-07-11T19:48:00+00:00", "remarks": "Generator replaced", "severity": "critical", "downtime_hours_estimated": 72 },
    { "timestamp": "2016-07-24T17:01:00+00:00", "remarks": "Generator temperature sensor failure", "severity": "moderate", "downtime_hours_estimated": 8 },
    { "timestamp": "2016-09-04T08:08:00+00:00", "remarks": "High temperature generator error", "severity": "major", "downtime_hours_estimated": 4 },
    { "timestamp": "2016-10-02T17:08:00+00:00", "remarks": "Refrigeration system and temperature sensors in generator replaced", "severity": "critical", "downtime_hours_estimated": 48 },
    { "timestamp": "2016-10-27T16:26:00+00:00", "remarks": "Generator replaced", "severity": "critical", "downtime_hours_estimated": 72 }
  ]
}
```

### Subsystem: T06 / HYDRAULIC / `_analytical`

```json
{
  "effective_since": "2016-04-04T18:53:00+00:00", "version": 2,
  "health_score": { "value": 0.78, "confidence": 0.85 },
  "failure_events": [
    { "timestamp": "2016-04-04T18:53:00+00:00", "remarks": "Error in pitch regulation", "severity": "moderate", "downtime_hours_estimated": 12 }
  ]
}
```

---

## T07 — Solo diferencias analíticas

### Equipment: T07 / `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00", "version": 3,
  "health_score": {
    "value": 0.85, "confidence": 0.88,
    "component_scores": { "GENERATOR": 0.88, "GEARBOX": 0.95, "HYDRAULIC": 0.96, "ROTOR": 0.94, "BLADES": 0.92, "HV_TRANSFORMER": 0.74, "INVERTER": 0.91, "GRID_CONNECTION": 0.93 }
  },
  "failure_history_summary": {
    "period": "2016-01-01/2016-12-31", "total_events": 3,
    "events": [
      { "timestamp": "2016-04-30T12:40:00+00:00", "component": "GENERATOR_BEARING", "remarks": "High temperature in generator bearing (replaced sensor)", "severity": "moderate" },
      { "timestamp": "2016-07-10T03:46:00+00:00", "component": "TRANSFORMER", "remarks": "High temperature transformer", "severity": "major" },
      { "timestamp": "2016-08-23T02:21:00+00:00", "component": "TRANSFORMER", "remarks": "High temperature transformer. Transformer refrigeration repaired", "severity": "major" }
    ],
    "mtbf_hours_estimated": 2190, "mttr_hours_estimated": 32
  }
}
```

### Subsystem: T07 / GENERATOR / `_analytical` (bearing event)

```json
{
  "effective_since": "2016-04-30T12:40:00+00:00", "version": 2,
  "health_score": { "value": 0.88, "confidence": 0.87 },
  "failure_events": [
    { "timestamp": "2016-04-30T12:40:00+00:00", "remarks": "High temperature in generator bearing (replaced sensor)", "severity": "moderate", "downtime_hours_estimated": 6, "note": "Sensor failure, not bearing failure — but triggered alarm investigation" }
  ]
}
```

### Subsystem: T07 / HV_TRANSFORMER / `_analytical`

```json
{
  "effective_since": "2016-08-23T02:21:00+00:00", "version": 3,
  "thresholds": {
    "HVTrafo_Phase1_Temp_Avg": { "warning_high": 90, "alarm_high": 110, "unit": "°C", "note": "Lowered after two thermal events" },
    "HVTrafo_Phase2_Temp_Avg": { "warning_high": 90, "alarm_high": 110, "unit": "°C" },
    "HVTrafo_Phase3_Temp_Avg": { "warning_high": 90, "alarm_high": 110, "unit": "°C" }
  },
  "health_score": { "value": 0.74, "confidence": 0.90, "note": "Refrigeration system repaired Aug 2016 — monitoring for recurrence" },
  "failure_events": [
    { "timestamp": "2016-07-10T03:46:00+00:00", "remarks": "High temperature transformer", "severity": "major", "downtime_hours_estimated": 16 },
    { "timestamp": "2016-08-23T02:21:00+00:00", "remarks": "High temperature transformer. Transformer refrigeration repaired", "severity": "major", "downtime_hours_estimated": 36 }
  ]
}
```

---

## T11 — Solo diferencias analíticas

### Equipment: T11 / `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00", "version": 2,
  "health_score": {
    "value": 0.88, "confidence": 0.87,
    "component_scores": { "GENERATOR": 0.85, "GEARBOX": 0.95, "HYDRAULIC": 0.80, "ROTOR": 0.94, "BLADES": 0.93, "HV_TRANSFORMER": 0.92, "INVERTER": 0.91, "GRID_CONNECTION": 0.93 }
  },
  "failure_history_summary": {
    "period": "2016-01-01/2016-12-31", "total_events": 2,
    "events": [
      { "timestamp": "2016-03-03T19:00:00+00:00", "component": "GENERATOR", "remarks": "Electric circuit error in generator", "severity": "major" },
      { "timestamp": "2016-10-17T17:44:00+00:00", "component": "HYDRAULIC_GROUP", "remarks": "Hydraulic group error in the brake circuit", "severity": "major" }
    ],
    "mtbf_hours_estimated": 3285, "mttr_hours_estimated": 28
  }
}
```

### Subsystem: T11 / GENERATOR / `_analytical`

```json
{
  "effective_since": "2016-03-03T19:00:00+00:00", "version": 2,
  "health_score": { "value": 0.85, "confidence": 0.86 },
  "failure_events": [
    { "timestamp": "2016-03-03T19:00:00+00:00", "remarks": "Electric circuit error in generator", "severity": "major", "downtime_hours_estimated": 18 }
  ]
}
```

### Subsystem: T11 / HYDRAULIC / `_analytical`

```json
{
  "effective_since": "2016-10-17T17:44:00+00:00", "version": 2,
  "health_score": { "value": 0.80, "confidence": 0.84 },
  "failure_events": [
    { "timestamp": "2016-10-17T17:44:00+00:00", "remarks": "Hydraulic group error in the brake circuit", "severity": "major", "downtime_hours_estimated": 16 }
  ]
}
```

---

## T09 — Caso especial: Equipment sin SCADA

### Topic base
```
uns/v1/GALERNA_ENERGY/SPAIN/GALICIA_COSTA_MORTE/T09/
```

### `_descriptive`

```json
{
  "schema_version": "1.0.0",
  "equipment_id": "T09",
  "equipment_type": "wind_turbine",
  "manufacturer": "Vestas",
  "model": "V90-2.0MW",
  "serial_number": "VES-V90-2012-CM-009",
  "rated_power_kw": 2000,
  "hub_height_m": 80,
  "rotor_diameter_m": 90,
  "commissioning_date": "2012-09-20",
  "coordinates": { "lat": 43.1255, "lon": -9.1798 },
  "elevation_m": 365,
  "scada_available": false,
  "scada_unavailability_reason": "SCADA data export not included in 2016 dataset — turbine physically operational",
  "subsystems": [
    "GENERATOR", "GEARBOX", "HYDRAULIC", "ROTOR", "BLADES",
    "NACELLE", "AMBIENT", "GRID_CONNECTION", "HV_TRANSFORMER",
    "INVERTER", "CONTROLLER", "POWER_OUTPUT"
  ]
}
```

### `_informational`

**No existe.** T09 no tiene telemetría en el dataset. El topic no se publica. Cualquier query al resolver LLM que intente leer `_informational` de T09 debe retornar el estado `NOT_FOUND` con el mensaje de `scada_unavailability_reason` del `_descriptive`.

### `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00", "version": 3,
  "health_score": { "value": null, "confidence": null, "note": "Cannot compute — no SCADA telemetry available. Failure logbook data only." },
  "failure_history_summary": {
    "period": "2016-01-01/2016-12-31", "total_events": 4,
    "events": [
      { "timestamp": "2016-06-07T16:59:00+00:00", "component": "GENERATOR_BEARING", "remarks": "High temperature generator bearing", "severity": "major" },
      { "timestamp": "2016-08-22T18:25:00+00:00", "component": "GENERATOR_BEARING", "remarks": "High temperature generator bearing", "severity": "major" },
      { "timestamp": "2016-10-11T08:06:00+00:00", "component": "GEARBOX", "remarks": "Gearbox repaired", "severity": "major" },
      { "timestamp": "2016-10-17T09:19:00+00:00", "component": "GENERATOR_BEARING", "remarks": "Generator bearings replaced", "severity": "critical" }
    ],
    "mtbf_hours_estimated": null, "mttr_hours_estimated": null,
    "note": "MTBF/MTTR cannot be computed without operational hours from SCADA"
  }
}
```

### Subsystem-level `_analytical` (T09)

T09 subsystems have `_descriptive` (same structure as T01) and `_analytical` (failure events only), but no `_informational`:

#### T09 / GENERATOR / `_analytical`

```json
{
  "effective_since": "2016-10-17T09:19:00+00:00", "version": 4,
  "thresholds": null,
  "health_score": { "value": null, "confidence": null },
  "failure_events": [
    { "timestamp": "2016-06-07T16:59:00+00:00", "remarks": "High temperature generator bearing", "severity": "major" },
    { "timestamp": "2016-08-22T18:25:00+00:00", "remarks": "High temperature generator bearing", "severity": "major" },
    { "timestamp": "2016-10-17T09:19:00+00:00", "remarks": "Generator bearings replaced", "severity": "critical", "note": "3 bearing events in 5 months — pattern similar to T06 generator issues" }
  ]
}
```

#### T09 / GEARBOX / `_analytical`

```json
{
  "effective_since": "2016-10-11T08:06:00+00:00", "version": 2,
  "thresholds": null,
  "health_score": { "value": null, "confidence": null },
  "failure_events": [
    { "timestamp": "2016-10-11T08:06:00+00:00", "remarks": "Gearbox repaired", "severity": "major" }
  ]
}
```

---

## METEO_STATION — Estación meteorológica de referencia

### Topic base
```
uns/v1/GALERNA_ENERGY/SPAIN/GALICIA_COSTA_MORTE/METEO_STATION/
```

### Equipment: METEO_STATION / `_descriptive`

```json
{
  "schema_version": "1.0.0",
  "equipment_id": "METEO_STATION",
  "equipment_type": "meteo_station",
  "designation": "METEO_STATION_06",
  "manufacturer": "Ammonit",
  "model": "Meteo-40M",
  "height_m": 60,
  "coordinates": { "lat": 43.1275, "lon": -9.1789 },
  "installation_date": "2011-03-15",
  "purpose": "Reference wind measurement and ambient conditions for park-level correlation",
  "data_scope": "park_level",
  "note": "Positioned at geographic center of park. Data is NOT turbine-specific — used as reference baseline for all turbines.",
  "subsystems": ["ANEMOMETER_1", "ANEMOMETER_2", "WIND_DIRECTION", "AMBIENT", "PRECIPITATION"]
}
```

### Equipment: METEO_STATION / `_informational`

```json
{
  "timestamp": "2016-06-24T13:50:00+00:00",
  "summary": {
    "wind_speed_primary_avg_ms": 3.2, "wind_speed_secondary_avg_ms": 3.2,
    "wind_direction_avg_deg": 236, "ambient_temp_avg_c": 30,
    "pressure_avg_hpa": 1010, "humidity_avg_pct": 38,
    "precipitation": false, "rain_detected": false
  }
}
```

### Equipment: METEO_STATION / `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00", "version": 1,
  "data_quality": {
    "wind_direction_constant_value_flag": true, "wind_direction_constant_value_deg": 236,
    "note": "Wind direction sensor reports 236° across most of the dataset — likely sensor stuck or configuration issue. Use turbine-local Amb_WindDir_Abs_Avg as alternative.",
    "humidity_missing_values": true
  },
  "anemometer_correlation": {
    "description": "Correlation between anemometer 1 and 2 for data quality validation",
    "expected_r2": 0.98, "deviation_threshold_ms": 0.5
  }
}
```

---

### Subsystem: METEO_STATION / ANEMOMETER_1

#### `_descriptive`

```json
{
  "schema_version": "1.0.0",
  "subsystem_id": "ANEMOMETER_1",
  "sensor_type": "cup_anemometer",
  "height_m": 60,
  "calibration": { "freq": 0.0499, "offset": 0.24, "corr_gain": 1, "corr_offset": 0 },
  "signals": {
    "Min_Windspeed1": { "unit": "m/s", "data_type": "float", "range_min": 0, "range_max": 25, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Max_Windspeed1": { "unit": "m/s", "data_type": "float", "range_min": 0, "range_max": 35, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Avg_Windspeed1": { "unit": "m/s", "data_type": "float", "range_min": 0, "range_max": 25, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "Var_Windspeed1": { "unit": "m/s", "data_type": "float", "range_min": 0, "range_max": 40, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Anemometer1_Avg_Freq": { "unit": "Hz", "data_type": "integer", "range_min": 0, "range_max": 450, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } }
  }
}
```

#### `_informational`

```json
{ "timestamp": "2016-06-24T13:50:00+00:00", "Min_Windspeed1": 0.9, "Max_Windspeed1": 5.4, "Avg_Windspeed1": 3.2, "Var_Windspeed1": 0.64, "Anemometer1_Avg_Freq": 60 }
```

#### `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00", "version": 1,
  "thresholds": { "Avg_Windspeed1": { "calm_below_ms": 1.0, "extreme_above_ms": 30.0, "unit": "m/s" } },
  "health_score": { "value": 0.95, "confidence": 0.90 },
  "failure_events": []
}
```

---

### Subsystem: METEO_STATION / ANEMOMETER_2

#### `_descriptive`

```json
{
  "schema_version": "1.0.0",
  "subsystem_id": "ANEMOMETER_2",
  "sensor_type": "cup_anemometer",
  "height_m": 58,
  "calibration": { "freq": 0.0499, "offset": 0.24, "corr_gain": 1, "corr_offset": 0 },
  "signals": {
    "Min_Windspeed2": { "unit": "m/s", "data_type": "float", "range_min": 0, "range_max": 25, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Max_Windspeed2": { "unit": "m/s", "data_type": "float", "range_min": 0, "range_max": 35, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Avg_Windspeed2": { "unit": "m/s", "data_type": "float", "range_min": 0, "range_max": 25, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "24h" } },
    "Var_Windspeed2": { "unit": "m/s", "data_type": "float", "range_min": 0, "range_max": 40, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Anemometer2_Avg_Freq": { "unit": "Hz", "data_type": "integer", "range_min": 0, "range_max": 450, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } }
  }
}
```

#### `_informational`

```json
{ "timestamp": "2016-06-24T13:50:00+00:00", "Min_Windspeed2": 1.5, "Max_Windspeed2": 5.2, "Avg_Windspeed2": 3.2, "Var_Windspeed2": 0.64, "Anemometer2_Avg_Freq": 60 }
```

#### `_analytical`

Misma estructura que ANEMOMETER_1.

---

### Subsystem: METEO_STATION / WIND_DIRECTION

#### `_descriptive`

```json
{
  "schema_version": "1.0.0",
  "subsystem_id": "WIND_DIRECTION",
  "sensor_type": "wind_vane",
  "height_m": 58,
  "signals": {
    "Min_Winddirection2": { "unit": "deg", "data_type": "integer", "range_min": 0, "range_max": 359, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Max_Winddirection2": { "unit": "deg", "data_type": "integer", "range_min": 0, "range_max": 359, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "24h" } },
    "Avg_Winddirection2": { "unit": "deg", "data_type": "integer", "range_min": 0, "range_max": 359, "default_chart": { "type": "wind_rose", "show_thresholds": false, "recommended_window": "30d", "note": "Sensor likely stuck at 236° — cross-reference with turbine-local data" } },
    "Var_Winddirection2": { "unit": "deg", "data_type": "integer", "range_min": 0, "range_max": 5000, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "7d" } }
  }
}
```

#### `_informational`

```json
{ "timestamp": "2016-06-24T13:50:00+00:00", "Min_Winddirection2": 236, "Max_Winddirection2": 236, "Avg_Winddirection2": 236, "Var_Winddirection2": 0 }
```

#### `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00", "version": 1,
  "data_quality_alert": {
    "status": "WARNING", "issue": "constant_value_detected", "constant_value_deg": 236,
    "description": "Wind direction reads 236° consistently across most records. Likely stuck sensor or misconfigured data channel.",
    "recommended_action": "Use turbine-local Amb_WindDir_Abs_Avg as alternative wind direction source",
    "variance_threshold_for_alert": 1
  },
  "health_score": { "value": 0.30, "confidence": 0.95, "note": "Sensor almost certainly non-functional" },
  "failure_events": []
}
```

---

### Subsystem: METEO_STATION / AMBIENT

#### `_descriptive`

```json
{
  "schema_version": "1.0.0",
  "subsystem_id": "AMBIENT",
  "description": "Temperature, pressure, and humidity sensors on meteorological mast",
  "calibration": { "distance_air_press": 0, "air_pressure_sensor_zero_offset": 600, "pressure_avg_freq": 410 },
  "signals": {
    "Min_AmbientTemp": { "unit": "°C", "data_type": "integer", "range_min": -40, "range_max": 45, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "7d" } },
    "Max_AmbientTemp": { "unit": "°C", "data_type": "integer", "range_min": -10, "range_max": 45, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "7d" } },
    "Avg_AmbientTemp": { "unit": "°C", "data_type": "integer", "range_min": -20, "range_max": 45, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "7d" } },
    "Min_Pressure": { "unit": "hPa", "data_type": "integer", "range_min": 980, "range_max": 1040, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "7d" } },
    "Max_Pressure": { "unit": "hPa", "data_type": "integer", "range_min": 980, "range_max": 1040, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "7d" } },
    "Avg_Pressure": { "unit": "hPa", "data_type": "integer", "range_min": 980, "range_max": 1040, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "7d" } },
    "Min_Humidity": { "unit": "%", "data_type": "integer", "range_min": 0, "range_max": 100, "note": "Contains at least one missing value in dataset", "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "7d" } },
    "Max_Humidity": { "unit": "%", "data_type": "integer", "range_min": 0, "range_max": 100, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "7d" } },
    "Avg_Humidity": { "unit": "%", "data_type": "integer", "range_min": 0, "range_max": 100, "note": "Contains at least one missing value in dataset", "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "7d" } },
    "Pressure_Avg_Freq": { "unit": "Hz", "data_type": "integer", "range_min": 380, "range_max": 440, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "7d" } }
  }
}
```

#### `_informational`

```json
{
  "timestamp": "2016-06-24T13:50:00+00:00",
  "Min_AmbientTemp": 29, "Max_AmbientTemp": 30, "Avg_AmbientTemp": 30,
  "Min_Pressure": 1010, "Max_Pressure": 1010, "Avg_Pressure": 1010,
  "Min_Humidity": 37, "Max_Humidity": 38, "Avg_Humidity": 38,
  "Pressure_Avg_Freq": 410
}
```

#### `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00", "version": 1,
  "thresholds": {
    "Avg_AmbientTemp": { "operating_min_c": -20, "operating_max_c": 45, "icing_risk_below_c": 2, "unit": "°C" },
    "Avg_Pressure": { "normal_range_hpa": [980, 1040], "unit": "hPa" },
    "Avg_Humidity": { "condensation_risk_above_pct": 85, "unit": "%" }
  },
  "data_quality": { "humidity_missing_values_detected": true, "note": "Min_Humidity and Avg_Humidity contain at least one NaN each" },
  "health_score": { "value": 0.88, "confidence": 0.85 },
  "failure_events": []
}
```

---

### Subsystem: METEO_STATION / PRECIPITATION

#### `_descriptive`

```json
{
  "schema_version": "1.0.0",
  "subsystem_id": "PRECIPITATION",
  "sensor_type": "tipping_bucket_rain_gauge_with_optical_detector",
  "note": "Raindetection is a binary signal (0/1) — Min/Max/Avg over the interval indicates if rain was detected at any point",
  "signals": {
    "Min_Precipitation": { "unit": "mm", "data_type": "integer", "range_min": 0, "range_max": 60, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "7d" } },
    "Max_Precipitation": { "unit": "mm", "data_type": "integer", "range_min": 0, "range_max": 80, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "7d" } },
    "Avg_Precipitation": { "unit": "mm", "data_type": "integer", "range_min": 0, "range_max": 80, "default_chart": { "type": "time_series", "show_thresholds": true, "recommended_window": "7d" } },
    "Min_Raindetection": { "unit": "bool", "data_type": "integer", "range_min": 0, "range_max": 1, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "7d" } },
    "Max_Raindetection": { "unit": "bool", "data_type": "integer", "range_min": 0, "range_max": 1, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "7d" } },
    "Avg_Raindetection": { "unit": "bool", "data_type": "integer", "range_min": 0, "range_max": 1, "default_chart": { "type": "time_series", "show_thresholds": false, "recommended_window": "7d" } }
  }
}
```

#### `_informational`

```json
{ "timestamp": "2016-06-24T13:50:00+00:00", "Min_Precipitation": 0, "Max_Precipitation": 0, "Avg_Precipitation": 0, "Min_Raindetection": 0, "Max_Raindetection": 0, "Avg_Raindetection": 0 }
```

#### `_analytical`

```json
{
  "effective_since": "2016-01-01T00:00:00+00:00", "version": 1,
  "thresholds": {
    "Avg_Precipitation": { "heavy_rain_mm_per_interval": 5, "unit": "mm" },
    "operational_impact": {
      "description": "Rain + low temperature = icing risk. Rain + high wind = blade erosion risk.",
      "icing_conditions": "precipitation > 0 AND Avg_AmbientTemp < 2°C",
      "erosion_conditions": "precipitation > 0 AND Avg_Windspeed1 > 15 m/s"
    }
  },
  "health_score": { "value": 0.95, "confidence": 0.88 },
  "failure_events": []
}
```

---

## Resumen de cobertura

| Equipment | Subsystems | `_descriptive` | `_informational` | `_analytical` | Failure events |
|---|---|---|---|---|---|
| **T01** (canónica) | 12 | Completo (signals como objeto con range + chart) | Completo (81 señales) | Completo con umbrales | 1 (GEARBOX) |
| **T06** (problemática) | 12 | = T01 + notas | = T01 estructura | Umbrales ajustados (GENERATOR, HYDRAULIC) | 6 (5 GEN + 1 HYD) |
| **T07** | 12 | = T01 | = T01 estructura | Umbrales ajustados (TRANSFORMER) | 3 (1 GEN_BEAR + 2 TRAFO) |
| **T11** | 12 | = T01 | = T01 estructura | Diferencias en scores | 2 (1 GEN + 1 HYD) |
| **T09** (sin SCADA) | 12 | Presente, `scada_available: false` | **No existe** | Solo failure events, sin scores | 4 (3 GEN_BEAR + 1 GEARBOX) |
| **METEO_STATION** | 5 | Completo + calibración (signals como objeto con range + chart) | Completo (30 señales operativas) | Data quality alerts (wind direction) | 0 |
| **Total** | — | 6 equipment + 65 subsystem | 435 señales | ~65 configs de umbrales | 16 eventos |

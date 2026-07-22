import { useMemo, useState } from "react";

import type {
  AggregationType,
  AssetInformationalField,
  AssetLevel,
  InformationalFieldCreatePayload,
  InformationalFieldUpdatePayload,
} from "./types";

type AssetInformationalTableProps = {
  assetLevel: AssetLevel;
  rows: AssetInformationalField[];
  onCreate: (payload: InformationalFieldCreatePayload) => void;
  onUpdate: (fieldId: string, payload: InformationalFieldUpdatePayload) => void;
  onDelete: (fieldId: string) => void;
  disabled?: boolean;
};

type Draft = {
  unit: string;
  rangeMin: string;
  rangeMax: string;
  aggType: string;
  sourceField: string;
  isActive: boolean;
};

function toDraft(field: AssetInformationalField): Draft {
  return {
    unit: field.unit,
    rangeMin: field.range_min == null ? "" : String(field.range_min),
    rangeMax: field.range_max == null ? "" : String(field.range_max),
    aggType: field.agg_type ?? "",
    sourceField: field.source_field ?? "",
    isActive: field.is_active,
  };
}

export function AssetInformationalTable({
  assetLevel,
  rows,
  onCreate,
  onUpdate,
  onDelete,
  disabled = false,
}: AssetInformationalTableProps) {
  const isSubsystem = assetLevel === "subsystem";

  const [createName, setCreateName] = useState("");
  const [createUnit, setCreateUnit] = useState("");
  const [createDataType, setCreateDataType] = useState<"float" | "integer">("float");
  const [createRangeMin, setCreateRangeMin] = useState("");
  const [createRangeMax, setCreateRangeMax] = useState("");
  const [createAggType, setCreateAggType] = useState("");
  const [createSourceField, setCreateSourceField] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const createPayload = useMemo<InformationalFieldCreatePayload | null>(() => {
    if (!createName.trim()) {
      return null;
    }

    if (isSubsystem) {
      if (createRangeMin.trim() === "" || createRangeMax.trim() === "") {
        return null;
      }
      const rangeMinNumber = Number.parseFloat(createRangeMin);
      const rangeMaxNumber = Number.parseFloat(createRangeMax);
      if (!Number.isFinite(rangeMinNumber) || !Number.isFinite(rangeMaxNumber)) {
        return null;
      }
      return {
        name: createName.trim(),
        unit: createUnit,
        data_type: createDataType,
        range_min: rangeMinNumber,
        range_max: rangeMaxNumber,
      };
    }

    if (!createAggType) {
      return null;
    }
    if (createAggType !== "custom" && !createSourceField.trim()) {
      return null;
    }

    return {
      name: createName.trim(),
      unit: createUnit,
      data_type: createDataType,
      agg_type: createAggType as AggregationType,
      source_field: createAggType === "custom" ? null : createSourceField,
    };
  }, [
    createAggType,
    createDataType,
    createName,
    createRangeMax,
    createRangeMin,
    createSourceField,
    createUnit,
    isSubsystem,
  ]);

  return (
    <section className="panel">
      <h4 className="panel-title">Asset Informational</h4>

      <div className="split-fields" style={{ marginTop: 10 }}>
        <div className="field-group">
          <label className="field-label" htmlFor="asset-info-name">
            name
          </label>
          <input
            className="field-input"
            id="asset-info-name"
            onChange={(event) => setCreateName(event.target.value)}
            value={createName}
          />
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="asset-info-unit">
            unit
          </label>
          <input
            className="field-input"
            id="asset-info-unit"
            onChange={(event) => setCreateUnit(event.target.value)}
            value={createUnit}
          />
        </div>
      </div>

      <div className="split-fields">
        <div className="field-group">
          <label className="field-label" htmlFor="asset-info-data-type">
            data_type
          </label>
          <select
            className="field-select"
            id="asset-info-data-type"
            onChange={(event) => setCreateDataType(event.target.value as "float" | "integer")}
            value={createDataType}
          >
            <option value="float">float</option>
            <option value="integer">integer</option>
          </select>
        </div>

        {isSubsystem ? (
          <>
            <div className="field-group">
              <label className="field-label" htmlFor="asset-info-range-min">
                range_min
              </label>
              <input
                className="field-input"
                id="asset-info-range-min"
                onChange={(event) => setCreateRangeMin(event.target.value)}
                value={createRangeMin}
              />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="asset-info-range-max">
                range_max
              </label>
              <input
                className="field-input"
                id="asset-info-range-max"
                onChange={(event) => setCreateRangeMax(event.target.value)}
                value={createRangeMax}
              />
            </div>
          </>
        ) : (
          <>
            <div className="field-group">
              <label className="field-label" htmlFor="asset-info-agg-type">
                agg_type
              </label>
              <select
                className="field-select"
                id="asset-info-agg-type"
                onChange={(event) => setCreateAggType(event.target.value)}
                value={createAggType}
              >
                <option value="">Select aggregation</option>
                <option value="sum">sum</option>
                <option value="avg">avg</option>
                <option value="min">min</option>
                <option value="max">max</option>
                <option value="count">count</option>
                <option value="weighted_avg">weighted_avg</option>
                <option value="custom">custom</option>
              </select>
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="asset-info-source-field">
                source_field
              </label>
              <input
                className="field-input"
                disabled={createAggType === "custom"}
                id="asset-info-source-field"
                onChange={(event) => setCreateSourceField(event.target.value)}
                value={createSourceField}
              />
            </div>
          </>
        )}
      </div>

      <div className="panel-toolbar">
        <button
          className="button"
          disabled={disabled || createPayload == null}
          onClick={() => {
            if (!createPayload) {
              return;
            }
            onCreate(createPayload);
            setCreateName("");
            setCreateUnit("");
            setCreateRangeMin("");
            setCreateRangeMax("");
            setCreateAggType("");
            setCreateSourceField("");
          }}
          type="button"
        >
          Add Field
        </button>
      </div>

      {rows.length === 0 ? <p className="message muted">No informational fields configured.</p> : null}

      <table className="table">
        <thead>
          <tr>
            <th>name</th>
            <th>unit</th>
            {isSubsystem ? <th>range_min</th> : <th>agg_type</th>}
            {isSubsystem ? <th>range_max</th> : <th>source_field</th>}
            <th>active</th>
            <th>actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const draft = drafts[row.id] ?? toDraft(row);

            return (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>
                  <input
                    className="field-input"
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.id]: { ...draft, unit: event.target.value },
                      }))
                    }
                    value={draft.unit}
                  />
                </td>
                <td>
                  {isSubsystem ? (
                    <input
                      className="field-input"
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [row.id]: { ...draft, rangeMin: event.target.value },
                        }))
                      }
                      value={draft.rangeMin}
                    />
                  ) : (
                    <select
                      className="field-select"
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [row.id]: { ...draft, aggType: event.target.value },
                        }))
                      }
                      value={draft.aggType}
                    >
                      <option value="sum">sum</option>
                      <option value="avg">avg</option>
                      <option value="min">min</option>
                      <option value="max">max</option>
                      <option value="count">count</option>
                      <option value="weighted_avg">weighted_avg</option>
                      <option value="custom">custom</option>
                    </select>
                  )}
                </td>
                <td>
                  {isSubsystem ? (
                    <input
                      className="field-input"
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [row.id]: { ...draft, rangeMax: event.target.value },
                        }))
                      }
                      value={draft.rangeMax}
                    />
                  ) : (
                    <input
                      className="field-input"
                      disabled={draft.aggType === "custom"}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [row.id]: { ...draft, sourceField: event.target.value },
                        }))
                      }
                      value={draft.sourceField}
                    />
                  )}
                </td>
                <td>
                  <input
                    checked={draft.isActive}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.id]: { ...draft, isActive: event.target.checked },
                      }))
                    }
                    type="checkbox"
                  />
                </td>
                <td>
                  <div className="inline-row">
                    <button
                      className="button secondary"
                      disabled={disabled}
                      onClick={() => {
                        const subsystemRangeMin = Number.parseFloat(draft.rangeMin);
                        const subsystemRangeMax = Number.parseFloat(draft.rangeMax);

                        const payload: InformationalFieldUpdatePayload = isSubsystem
                          ? {
                              unit: draft.unit,
                              range_min: Number.isFinite(subsystemRangeMin) ? subsystemRangeMin : null,
                              range_max: Number.isFinite(subsystemRangeMax) ? subsystemRangeMax : null,
                              is_active: draft.isActive,
                            }
                          : {
                              unit: draft.unit,
                              agg_type: draft.aggType as AggregationType,
                              source_field: draft.aggType === "custom" ? null : draft.sourceField,
                              is_active: draft.isActive,
                            };
                        onUpdate(row.id, payload);
                      }}
                      type="button"
                    >
                      Save
                    </button>
                    <button className="button danger" disabled={disabled} onClick={() => onDelete(row.id)} type="button">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

import { useMemo, useState } from "react";

import { levelLabel, type Isa95Level } from "../../shared/data/isa95";
import type { TemplateChild } from "./types";

type ChildOption = {
  id: string;
  name: string;
  level: Isa95Level;
};

type TemplateChildrenTableProps = {
  rows: TemplateChild[];
  options: ChildOption[];
  onAddChild: (payload: { child_template_id: string; sort_order: number; is_optional: boolean }) => void;
  onDeleteChild: (childTemplateId: string) => void;
  disabled?: boolean;
};

export function TemplateChildrenTable({
  rows,
  options,
  onAddChild,
  onDeleteChild,
  disabled = false,
}: TemplateChildrenTableProps) {
  const [selectedChildId, setSelectedChildId] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [optional, setOptional] = useState(false);

  const canAdd = useMemo(
    () => selectedChildId.length > 0 && !disabled,
    [disabled, selectedChildId.length],
  );

  return (
    <section className="panel">
      <h4 className="panel-title">Template Children</h4>
      <div className="inline-row" style={{ marginTop: 10 }}>
        <select
          aria-label="Child Template"
          className="field-select"
          disabled={disabled}
          onChange={(event) => setSelectedChildId(event.target.value)}
          value={selectedChildId}
        >
          <option value="">Select child template</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} ({levelLabel(option.level)})
            </option>
          ))}
        </select>

        <input
          aria-label="Child Sort Order"
          className="field-input"
          disabled={disabled}
          onChange={(event) => setSortOrder(event.target.value)}
          placeholder="Sort"
          style={{ maxWidth: 92 }}
          value={sortOrder}
        />

        <label className="chip" style={{ cursor: "pointer" }}>
          <input
            checked={optional}
            disabled={disabled}
            onChange={(event) => setOptional(event.target.checked)}
            type="checkbox"
          />
          Optional
        </label>

        <button
          className="button"
          disabled={!canAdd}
          onClick={() => {
            if (!canAdd) {
              return;
            }
            onAddChild({
              child_template_id: selectedChildId,
              is_optional: optional,
              sort_order: Number.parseInt(sortOrder || "0", 10) || 0,
            });
            setSelectedChildId("");
            setSortOrder("0");
            setOptional(false);
          }}
          type="button"
        >
          Add Child
        </button>
      </div>

      {rows.length === 0 ? <p className="message muted">No linked child templates.</p> : null}

      <table className="table">
        <thead>
          <tr>
            <th>name</th>
            <th>level</th>
            <th>optional</th>
            <th>sort</th>
            <th>actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.child_name}</td>
              <td>{row.child_level}</td>
              <td>{row.is_optional ? "yes" : "no"}</td>
              <td>{row.sort_order}</td>
              <td>
                <button
                  className="button secondary"
                  disabled={disabled}
                  onClick={() => onDeleteChild(row.child_template_id)}
                  type="button"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

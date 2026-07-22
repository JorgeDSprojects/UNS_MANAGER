import type { InformationalField } from "./types";

type TemplateInformationalTableProps = {
  templateLevel: "enterprise" | "site" | "area" | "equipment" | "subsystem";
  rows: InformationalField[];
  onCreate: () => void;
  onDelete: (fieldId: string) => void;
};

export function TemplateInformationalTable({
  templateLevel,
  rows,
  onCreate,
  onDelete,
}: TemplateInformationalTableProps) {
  const isSubsystem = templateLevel === "subsystem";

  return (
    <section className="rounded border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">Informational Fields</h4>
        <button className="rounded border border-slate-300 px-2 py-1 text-sm" onClick={onCreate} type="button">
          Add Field
        </button>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-slate-700">
            <th>name</th>
            <th>unit</th>
            {isSubsystem ? <th>range_min</th> : <th>agg_type</th>}
            {isSubsystem ? <th>range_max</th> : <th>source_field</th>}
            <th>actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-200">
              <td>{row.name}</td>
              <td>{row.unit}</td>
              <td>{isSubsystem ? row.range_min ?? "-" : row.agg_type ?? "-"}</td>
              <td>{isSubsystem ? row.range_max ?? "-" : row.source_field ?? "-"}</td>
              <td>
                <button
                  className="rounded border border-slate-300 px-2 py-1 text-xs"
                  onClick={() => onDelete(row.id)}
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

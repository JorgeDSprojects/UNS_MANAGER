import type { TemplateChild } from "./types";

type TemplateChildrenTableProps = {
  rows: TemplateChild[];
  onAddChild: () => void;
  onDeleteChild: (childTemplateId: string) => void;
};

export function TemplateChildrenTable({ rows, onAddChild, onDeleteChild }: TemplateChildrenTableProps) {
  return (
    <section className="rounded border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">Template Children</h4>
        <button className="rounded border border-slate-300 px-2 py-1 text-sm" onClick={onAddChild} type="button">
          Add Child
        </button>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-slate-700">
            <th>name</th>
            <th>level</th>
            <th>optional</th>
            <th>actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-200">
              <td>{row.child_name}</td>
              <td>{row.child_level}</td>
              <td>{row.is_optional ? "yes" : "no"}</td>
              <td>
                <button
                  className="rounded border border-slate-300 px-2 py-1 text-xs"
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

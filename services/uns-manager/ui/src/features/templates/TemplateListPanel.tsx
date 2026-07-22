import type { TemplateRecord } from "./types";

type TemplateListPanelProps = {
  templates: TemplateRecord[];
  selectedId: string | null;
  onSelect: (templateId: string) => void;
};

export function TemplateListPanel({ templates, selectedId, onSelect }: TemplateListPanelProps) {
  return (
    <section aria-label="Template List" className="rounded border border-slate-200 bg-white p-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Template Catalog</h3>
      <ul className="space-y-1">
        {templates.map((template) => (
          <li key={template.id}>
            <button
              type="button"
              className={selectedId === template.id ? "font-semibold" : "text-slate-700"}
              onClick={() => onSelect(template.id)}
            >
              {template.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

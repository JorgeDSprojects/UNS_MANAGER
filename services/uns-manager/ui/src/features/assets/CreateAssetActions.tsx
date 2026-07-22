import { useMemo, useState } from "react";

type TemplateOption = { id: string; name: string };

type CreateAssetActionsProps = {
  parentId: string | null;
  allowedTemplates: TemplateOption[];
  onCreateManual: () => void;
  onCreateFromTemplate: (payload: { parent_id: string; template_id: string }) => void;
};

export function CreateAssetActions({
  parentId,
  allowedTemplates,
  onCreateManual,
  onCreateFromTemplate,
}: CreateAssetActionsProps) {
  const [templateId, setTemplateId] = useState("");
  const canCreateFromTemplate = useMemo(
    () => Boolean(parentId) && templateId.length > 0,
    [parentId, templateId],
  );

  return (
    <section className="rounded border border-slate-200 bg-white p-3">
      <h4 className="mb-2 text-sm font-semibold text-slate-700">Create Asset</h4>
      <div className="flex flex-wrap items-end gap-2">
        <button className="rounded border border-slate-300 px-2 py-1 text-sm" onClick={onCreateManual} type="button">
          Create Manual
        </button>

        <div>
          <label className="block text-sm" htmlFor="template-select">
            Template
          </label>
          <select
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            id="template-select"
            onChange={(event) => setTemplateId(event.target.value)}
            value={templateId}
          >
            <option value="">Select template</option>
            {allowedTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        <button
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          disabled={!canCreateFromTemplate}
          onClick={() => {
            if (parentId && templateId) {
              onCreateFromTemplate({ parent_id: parentId, template_id: templateId });
            }
          }}
          type="button"
        >
          Create from Template
        </button>
      </div>
    </section>
  );
}

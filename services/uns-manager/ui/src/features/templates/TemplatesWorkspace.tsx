import { useState } from "react";

import { TemplateEditorPanel } from "./TemplateEditorPanel";
import { TemplateListPanel } from "./TemplateListPanel";
import { useTemplatesListQuery } from "./hooks";

export function TemplatesWorkspace() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const templatesQuery = useTemplatesListQuery();

  if (templatesQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading templates...</p>;
  }

  if (templatesQuery.isError) {
    return <p className="text-sm text-red-600">{templatesQuery.error.message}</p>;
  }

  const templates = templatesQuery.data ?? [];

  return (
    <div className="grid gap-4 md:grid-cols-[300px,1fr]">
      <TemplateListPanel onSelect={setSelectedId} selectedId={selectedId} templates={templates} />
      <TemplateEditorPanel selectedId={selectedId} />
    </div>
  );
}

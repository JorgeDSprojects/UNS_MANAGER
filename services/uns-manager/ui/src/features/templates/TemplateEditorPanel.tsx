import { useEffect, useMemo, useState } from "react";

import { useDirtyGuard } from "../../shared/forms/useDirtyGuard";
import { ErrorBanner } from "../../shared/ui/ErrorBanner";
import { useSaveTemplateMutation, useTemplateDetailQuery } from "./hooks";

export function TemplateEditorPanel({ selectedId }: { selectedId: string | null }) {
  const detailQuery = useTemplateDetailQuery(selectedId);
  const saveMutation = useSaveTemplateMutation();
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (detailQuery.data) {
      setDisplayName(detailQuery.data.display_name);
    }
  }, [detailQuery.data]);

  const canSave = useMemo(
    () => Boolean(selectedId) && displayName.trim().length > 0,
    [displayName, selectedId],
  );
  const isDirty = Boolean(detailQuery.data) && displayName !== detailQuery.data?.display_name;
  const { confirmNavigation } = useDirtyGuard(isDirty);

  const onSave = () => {
    if (!selectedId) {
      return;
    }

    saveMutation.mutate({
      id: selectedId,
      payload: { display_name: displayName },
    });
  };

  if (!selectedId) {
    return (
      <section className="rounded border border-slate-200 bg-white p-3">
        <h3 className="text-sm font-semibold text-slate-700">Template Editor</h3>
        <p className="mt-2 text-sm text-slate-500">Select a template to edit.</p>
      </section>
    );
  }

  const onReset = () => {
    if (!confirmNavigation()) {
      return;
    }
    setDisplayName(detailQuery.data?.display_name ?? "");
  };

  return (
    <section className="rounded border border-slate-200 bg-white p-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Template Editor</h3>
      {detailQuery.isLoading ? <p className="text-sm text-slate-500">Loading template...</p> : null}
      {detailQuery.isError ? <ErrorBanner message={detailQuery.error.message} /> : null}

      <div className="space-y-2">
        <label className="block text-sm" htmlFor="template-display-name">
          Display Name
        </label>
        <input
          id="template-display-name"
          className="w-full rounded border border-slate-300 px-2 py-1"
          onChange={(event) => setDisplayName(event.target.value)}
          value={displayName}
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          disabled={!canSave || saveMutation.isPending}
          onClick={onSave}
          type="button"
        >
          Save
        </button>
        <button className="rounded border border-slate-300 px-2 py-1 text-sm" onClick={onReset} type="button">
          Reset
        </button>
        {saveMutation.isSuccess ? <p className="text-sm text-emerald-700">Saved</p> : null}
        {saveMutation.isError ? <ErrorBanner message={saveMutation.error.message} /> : null}
      </div>
    </section>
  );
}

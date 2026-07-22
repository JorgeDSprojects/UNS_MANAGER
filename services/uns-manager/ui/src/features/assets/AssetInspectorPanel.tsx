import { useEffect, useMemo, useState } from "react";

import { useDirtyGuard } from "../../shared/forms/useDirtyGuard";
import { ErrorBanner } from "../../shared/ui/ErrorBanner";
import { validateAssetName } from "../../shared/validation/assetName";
import { useAssetDetailQuery, useUpdateAssetMutation } from "./hooks";

type AssetInspectorPanelProps = {
  selectedAssetId: string | null;
};

export function AssetInspectorPanel({ selectedAssetId }: AssetInspectorPanelProps) {
  const detailQuery = useAssetDetailQuery(selectedAssetId);
  const updateMutation = useUpdateAssetMutation();
  const [assetName, setAssetName] = useState("");

  useEffect(() => {
    if (detailQuery.data) {
      setAssetName(detailQuery.data.name);
    }
  }, [detailQuery.data]);

  const canSave = useMemo(
    () => Boolean(selectedAssetId) && assetName.trim().length > 0,
    [assetName, selectedAssetId],
  );
  const validationError = validateAssetName(assetName);
  const shownValidationError = assetName.length > 0 ? validationError : null;
  const isDirty = Boolean(detailQuery.data) && assetName !== detailQuery.data?.name;
  const { confirmNavigation } = useDirtyGuard(isDirty);

  if (!selectedAssetId) {
    return (
      <section className="rounded border border-slate-200 bg-white p-3">
        <h4 className="text-sm font-semibold text-slate-700">Asset Inspector</h4>
        <p className="mt-2 text-sm text-slate-500">Select an asset to inspect.</p>
      </section>
    );
  }

  return (
    <section className="rounded border border-slate-200 bg-white p-3">
      <h4 className="mb-2 text-sm font-semibold text-slate-700">Asset Inspector</h4>
      {detailQuery.isLoading ? <p className="text-sm text-slate-500">Loading asset...</p> : null}
      {detailQuery.isError ? <ErrorBanner message={detailQuery.error.message} /> : null}

      <label className="block text-sm" htmlFor="asset-name">
        Asset Name
      </label>
      <input
        className="w-full rounded border border-slate-300 px-2 py-1"
        id="asset-name"
        onChange={(event) => setAssetName(event.target.value)}
        value={assetName}
      />
      {shownValidationError ? <p className="mt-1 text-sm text-red-600">{shownValidationError}</p> : null}

      <div className="mt-3 flex items-center gap-2">
        <button
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          disabled={!canSave || updateMutation.isPending || Boolean(shownValidationError)}
          onClick={() => {
            if (selectedAssetId) {
              updateMutation.mutate({ id: selectedAssetId, payload: { name: assetName } });
            }
          }}
          type="button"
        >
          Save
        </button>
        <button
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          onClick={() => {
            if (!confirmNavigation()) {
              return;
            }
            setAssetName(detailQuery.data?.name ?? "");
          }}
          type="button"
        >
          Reset
        </button>
        {updateMutation.isSuccess ? <p className="text-sm text-emerald-700">Saved</p> : null}
        {updateMutation.isError ? <ErrorBanner message={updateMutation.error.message} /> : null}
      </div>
    </section>
  );
}

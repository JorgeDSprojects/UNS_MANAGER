import { useMemo, useState } from "react";

import { useToast } from "../../shared/ui/ToastProvider";
import { ErrorBanner } from "../../shared/ui/ErrorBanner";
import { useTemplatesListQuery } from "../templates/hooks";
import { AssetInspectorPanel } from "./AssetInspectorPanel";
import { AssetsTreePanel } from "./AssetsTreePanel";
import { CreateAssetActions } from "./CreateAssetActions";
import { useAssetsTreeQuery, useCreateAssetMutation, useCreateFromTemplateMutation } from "./hooks";
import type { AssetRecord, CreateAssetFromTemplatePayload, CreateAssetPayload } from "./types";

function flattenAssets(tree: AssetRecord[]): AssetRecord[] {
  const result: AssetRecord[] = [];
  const stack = [...tree];

  while (stack.length > 0) {
    const current = stack.shift();
    if (!current) {
      continue;
    }
    result.push(current);
    if (current.children?.length) {
      stack.unshift(...current.children);
    }
  }

  return result;
}

export function AssetsWorkspace() {
  const assetsTreeQuery = useAssetsTreeQuery();
  const templatesQuery = useTemplatesListQuery();
  const createManualMutation = useCreateAssetMutation();
  const createFromTemplateMutation = useCreateFromTemplateMutation();
  const { pushToast } = useToast();

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const assets = assetsTreeQuery.data ?? [];
  const flattenedAssets = useMemo(() => flattenAssets(assets), [assets]);
  const selectedParent = useMemo(
    () => flattenedAssets.find((asset) => asset.id === selectedAssetId) ?? null,
    [flattenedAssets, selectedAssetId],
  );
  const templateOptions = useMemo(
    () =>
      (templatesQuery.data ?? []).map((template) => ({
        id: template.id,
        name: template.name,
        level: template.level,
      })),
    [templatesQuery.data],
  );

  return (
    <div className="panel-grid two-col">
      <div className="panel-grid">
        <CreateAssetActions
          disabled={createManualMutation.isPending || createFromTemplateMutation.isPending}
          onCreateFromTemplate={(payload: CreateAssetFromTemplatePayload) => {
            createFromTemplateMutation.mutate(payload, {
              onSuccess: (created) => {
                setSelectedAssetId(created.id);
                pushToast("Asset created from template", "success");
              },
              onError: (error) => pushToast(error.message, "error"),
            });
          }}
          onCreateManual={(payload: CreateAssetPayload) => {
            createManualMutation.mutate(payload, {
              onSuccess: (created) => {
                setSelectedAssetId(created.id);
                pushToast("Asset created", "success");
              },
              onError: (error) => pushToast(error.message, "error"),
            });
          }}
          selectedParent={selectedParent ? { id: selectedParent.id, level: selectedParent.asset_level, name: selectedParent.name } : null}
          templateOptions={templateOptions}
        />

        {assetsTreeQuery.isError ? <ErrorBanner message={assetsTreeQuery.error.message} /> : null}
        {templatesQuery.isError ? <ErrorBanner message={templatesQuery.error.message} /> : null}

        <AssetsTreePanel assets={assets} onSelect={setSelectedAssetId} selectedAssetId={selectedAssetId} />
      </div>

      <AssetInspectorPanel onDeleted={() => setSelectedAssetId(null)} selectedAssetId={selectedAssetId} />
    </div>
  );
}

import { useMemo, useState } from "react";

import { useTemplatesListQuery } from "../templates/hooks";
import { AssetInspectorPanel } from "./AssetInspectorPanel";
import { AssetsTreePanel } from "./AssetsTreePanel";
import { CreateAssetActions } from "./CreateAssetActions";
import { useAssetsTreeQuery, useCreateAssetMutation, useCreateFromTemplateMutation } from "./hooks";

export function AssetsWorkspace() {
  const assetsTreeQuery = useAssetsTreeQuery();
  const templatesQuery = useTemplatesListQuery();
  const createManualMutation = useCreateAssetMutation();
  const createFromTemplateMutation = useCreateFromTemplateMutation();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const templateOptions = useMemo(
    () =>
      (templatesQuery.data ?? []).map((template) => ({
        id: template.id,
        name: template.name,
      })),
    [templatesQuery.data],
  );

  const assets = assetsTreeQuery.data ?? [];

  return (
    <div className="space-y-4">
      <CreateAssetActions
        allowedTemplates={templateOptions}
        onCreateFromTemplate={(payload) => {
          createFromTemplateMutation.mutate({
            parent_id: payload.parent_id,
            template_id: payload.template_id,
            name: `ASSET_${Date.now()}`,
            descriptive_overrides: {},
            analytical_overrides: {},
          });
        }}
        onCreateManual={() => {
          createManualMutation.mutate({
            asset_level: "enterprise",
            name: `ENTERPRISE_${Date.now()}`,
            descriptive: {},
            analytical: {},
          });
        }}
        parentId={selectedAssetId}
      />

      {(assetsTreeQuery.isError || templatesQuery.isError) ? (
        <p className="text-sm text-red-600">Could not load assets workspace data.</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[320px,1fr]">
        <AssetsTreePanel assets={assets} onSelect={setSelectedAssetId} selectedAssetId={selectedAssetId} />
        <AssetInspectorPanel selectedAssetId={selectedAssetId} />
      </div>
    </div>
  );
}

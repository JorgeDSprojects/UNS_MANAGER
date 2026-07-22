import type { AssetRecord } from "./types";

type AssetsTreePanelProps = {
  assets: AssetRecord[];
  selectedAssetId: string | null;
  onSelect: (assetId: string) => void;
};

function renderAssetNode(
  asset: AssetRecord,
  selectedAssetId: string | null,
  onSelect: (assetId: string) => void,
): JSX.Element {
  const children = asset.children ?? [];

  return (
    <li key={asset.id} className="mt-1">
      <button
        className={selectedAssetId === asset.id ? "font-semibold" : "text-slate-700"}
        onClick={() => onSelect(asset.id)}
        type="button"
      >
        {asset.name}
      </button>
      {children.length > 0 ? (
        <ul className="ml-4 list-none">
          {children.map((child) => renderAssetNode(child, selectedAssetId, onSelect))}
        </ul>
      ) : null}
    </li>
  );
}

export function AssetsTreePanel({ assets, selectedAssetId, onSelect }: AssetsTreePanelProps) {
  return (
    <section className="rounded border border-slate-200 bg-white p-3">
      <h4 className="mb-2 text-sm font-semibold text-slate-700">ISA-95</h4>
      <ul className="list-none">{assets.map((asset) => renderAssetNode(asset, selectedAssetId, onSelect))}</ul>
    </section>
  );
}

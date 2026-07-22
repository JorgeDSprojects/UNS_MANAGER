import type { AssetRecord } from "./types";

type AssetsTreePanelProps = {
  assets: AssetRecord[];
  selectedAssetId: string | null;
  onSelect: (assetId: string) => void;
};

function renderNode(
  asset: AssetRecord,
  selectedAssetId: string | null,
  onSelect: (assetId: string) => void,
): JSX.Element {
  const children = asset.children ?? [];

  return (
    <li key={asset.id}>
      <div className="tree-node">
        <button
          className={selectedAssetId === asset.id ? "active" : ""}
          onClick={() => onSelect(asset.id)}
          type="button"
        >
          {asset.name}
        </button>
        <span className="tag">{asset.asset_level}</span>
      </div>
      {children.length > 0 ? <ul>{children.map((child) => renderNode(child, selectedAssetId, onSelect))}</ul> : null}
    </li>
  );
}

export function AssetsTreePanel({ assets, selectedAssetId, onSelect }: AssetsTreePanelProps) {
  return (
    <section className="panel">
      <h4 className="panel-title">ISA-95 Tree</h4>
      {assets.length === 0 ? <p className="message muted">No assets found.</p> : null}
      <ul className="tree-list">{assets.map((asset) => renderNode(asset, selectedAssetId, onSelect))}</ul>
    </section>
  );
}

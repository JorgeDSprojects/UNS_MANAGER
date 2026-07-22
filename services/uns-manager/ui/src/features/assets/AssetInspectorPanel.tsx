import { useEffect, useMemo, useRef, useState } from "react";

import { ISA95_LEVELS, levelLabel } from "../../shared/data/isa95";
import { useDirtyGuard } from "../../shared/forms/useDirtyGuard";
import { formatJson, parseJsonInput } from "../../shared/forms/jsonEditor";
import { useToast } from "../../shared/ui/ToastProvider";
import { ErrorBanner } from "../../shared/ui/ErrorBanner";
import { validateAssetName } from "../../shared/validation/assetName";
import { AssetInformationalTable } from "./AssetInformationalTable";
import {
  useAssetDetailQuery,
  useCreateAssetInformationalMutation,
  useDeleteAssetInformationalMutation,
  useDeleteAssetMutation,
  useUpdateAssetInformationalMutation,
  useUpdateAssetMutation,
} from "./hooks";
import type { InformationalFieldCreatePayload, InformationalFieldUpdatePayload } from "./types";

type AssetInspectorPanelProps = {
  selectedAssetId: string | null;
  onDeleted: () => void;
};

export function AssetInspectorPanel({ selectedAssetId, onDeleted }: AssetInspectorPanelProps) {
  const detailQuery = useAssetDetailQuery(selectedAssetId);
  const updateMutation = useUpdateAssetMutation();
  const deleteMutation = useDeleteAssetMutation();
  const createInfoMutation = useCreateAssetInformationalMutation();
  const updateInfoMutation = useUpdateAssetInformationalMutation();
  const deleteInfoMutation = useDeleteAssetInformationalMutation();
  const { pushToast } = useToast();

  const [assetName, setAssetName] = useState("");
  const [descriptiveJson, setDescriptiveJson] = useState("{}");
  const [analyticalJson, setAnalyticalJson] = useState("{}");
  const [scadaAvailable, setScadaAvailable] = useState(true);
  const [active, setActive] = useState(true);
  const [copiedKey, setCopiedKey] = useState<"asset" | "descriptive" | "analytical" | null>(null);
  const copiedFeedbackTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (detailQuery.data) {
      setAssetName(detailQuery.data.name);
      setDescriptiveJson(formatJson(detailQuery.data.descriptive));
      setAnalyticalJson(formatJson(detailQuery.data.analytical));
      setScadaAvailable(detailQuery.data.scada_available);
      setActive(detailQuery.data.is_active);
    }
  }, [detailQuery.data]);

  const nameError = assetName.length > 0 ? validateAssetName(assetName) : null;
  const descriptiveParse = useMemo(() => parseJsonInput(descriptiveJson), [descriptiveJson]);
  const analyticalParse = useMemo(() => parseJsonInput(analyticalJson), [analyticalJson]);

  const currentDetail = detailQuery.data;
  const assetPath = currentDetail?.uns_path ?? "ROOT";
  const descriptivePath = `${assetPath}.descriptive`;
  const analyticalPath = `${assetPath}.analytical`;

  useEffect(() => {
    return () => {
      if (copiedFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copiedFeedbackTimeoutRef.current);
      }
    };
  }, []);

  async function copyToClipboard(
    value: string,
    copiedTarget: "asset" | "descriptive" | "analytical",
    successMessage: string,
  ): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const temporaryInput = document.createElement("textarea");
        temporaryInput.value = value;
        temporaryInput.style.position = "fixed";
        temporaryInput.style.opacity = "0";
        document.body.appendChild(temporaryInput);
        temporaryInput.focus();
        temporaryInput.select();
        document.execCommand("copy");
        document.body.removeChild(temporaryInput);
      }

      if (copiedFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copiedFeedbackTimeoutRef.current);
      }

      setCopiedKey(copiedTarget);
      copiedFeedbackTimeoutRef.current = window.setTimeout(() => {
        setCopiedKey(null);
      }, 1500);

      pushToast(successMessage, "success");
    } catch {
      pushToast("Unable to copy to clipboard", "error");
    }
  }

  const isDirty = Boolean(currentDetail) && (
    assetName !== currentDetail.name ||
    descriptiveJson !== formatJson(currentDetail.descriptive) ||
    analyticalJson !== formatJson(currentDetail.analytical) ||
    scadaAvailable !== currentDetail.scada_available ||
    active !== currentDetail.is_active
  );
  const { confirmNavigation } = useDirtyGuard(isDirty);

  const canSave = Boolean(
    selectedAssetId &&
      !nameError &&
      assetName.trim().length > 0 &&
      descriptiveParse.ok &&
      analyticalParse.ok,
  );

  if (!selectedAssetId) {
    return (
      <section className="panel">
        <h4 className="panel-title">Asset Inspector</h4>
        <p className="message muted">Select an asset node to inspect and edit runtime fields.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h4 className="panel-title">Asset Inspector</h4>

      <div className="inspector-context">
        <div className="isa-level-strip" role="list" aria-label="ISA-95 levels">
          {ISA95_LEVELS.map((level) => (
            <span
              className={`isa-level-pill${currentDetail?.asset_level === level ? " is-current" : ""}`}
              key={level}
              role="listitem"
            >
              {levelLabel(level)}
            </span>
          ))}
        </div>

        <div className="inline-row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
          <button
            className="button secondary"
            onClick={() => void copyToClipboard(assetPath, "asset", "Asset path copied")}
            type="button"
          >
            {copiedKey === "asset" ? "Copied" : "Copy Path"}
          </button>
        </div>

        <p className="path-readout">Path: {assetPath}</p>
      </div>

      {detailQuery.isLoading ? <p className="message muted">Loading asset...</p> : null}
      {detailQuery.isError ? <ErrorBanner message={detailQuery.error.message} /> : null}

      <div className="split-fields" style={{ marginTop: 10 }}>
        <div className="field-group">
          <label className="field-label" htmlFor="asset-name">
            Asset Name
          </label>
          <input
            className="field-input"
            id="asset-name"
            onChange={(event) => setAssetName(event.target.value)}
            value={assetName}
          />
          {nameError ? <p className="message error">{nameError}</p> : null}
        </div>

        <div className="field-group">
          <label className="field-label">State</label>
          <label className="chip" style={{ cursor: "pointer", width: "fit-content" }}>
            <input
              checked={scadaAvailable}
              onChange={(event) => setScadaAvailable(event.target.checked)}
              type="checkbox"
            />
            SCADA available
          </label>
          <label className="chip" style={{ cursor: "pointer", width: "fit-content" }}>
            <input checked={active} onChange={(event) => setActive(event.target.checked)} type="checkbox" />
            Active
          </label>
        </div>
      </div>

      <div className="split-fields">
        <div className="field-group">
          <div className="field-label-row">
            <label className="field-label" htmlFor="asset-descriptive-json">
              Descriptive (JSON)
            </label>
            <button
              className="copy-link"
              onClick={() => void copyToClipboard(descriptivePath, "descriptive", "Descriptive path copied")}
              type="button"
            >
              {copiedKey === "descriptive" ? "Copied" : "Copy Path"}
            </button>
          </div>
          <textarea
            className="field-textarea"
            id="asset-descriptive-json"
            onChange={(event) => setDescriptiveJson(event.target.value)}
            value={descriptiveJson}
          />
          {!descriptiveParse.ok ? <p className="message error">{descriptiveParse.error}</p> : null}
        </div>

        <div className="field-group">
          <div className="field-label-row">
            <label className="field-label" htmlFor="asset-analytical-json">
              Analytical (JSON)
            </label>
            <button
              className="copy-link"
              onClick={() => void copyToClipboard(analyticalPath, "analytical", "Analytical path copied")}
              type="button"
            >
              {copiedKey === "analytical" ? "Copied" : "Copy Path"}
            </button>
          </div>
          <textarea
            className="field-textarea"
            id="asset-analytical-json"
            onChange={(event) => setAnalyticalJson(event.target.value)}
            value={analyticalJson}
          />
          {!analyticalParse.ok ? <p className="message error">{analyticalParse.error}</p> : null}
        </div>
      </div>

      <div className="panel-toolbar">
        <button
          className="button"
          disabled={!canSave || updateMutation.isPending}
          onClick={() => {
            if (!selectedAssetId || !descriptiveParse.ok || !analyticalParse.ok) {
              return;
            }

            updateMutation.mutate(
              {
                id: selectedAssetId,
                payload: {
                  name: assetName,
                  descriptive: descriptiveParse.value,
                  analytical: analyticalParse.value,
                  scada_available: scadaAvailable,
                  is_active: active,
                },
              },
              {
                onSuccess: () => pushToast("Asset saved", "success"),
                onError: (error) => pushToast(error.message, "error"),
              },
            );
          }}
          type="button"
        >
          Save
        </button>
        <button
          className="button secondary"
          onClick={() => {
            if (!confirmNavigation() || !currentDetail) {
              return;
            }
            setAssetName(currentDetail.name);
            setDescriptiveJson(formatJson(currentDetail.descriptive));
            setAnalyticalJson(formatJson(currentDetail.analytical));
            setScadaAvailable(currentDetail.scada_available);
            setActive(currentDetail.is_active);
          }}
          type="button"
        >
          Discard
        </button>
        <button
          className="button danger"
          onClick={() => {
            if (!selectedAssetId || !window.confirm("Delete selected asset and descendants?")) {
              return;
            }
            deleteMutation.mutate(selectedAssetId, {
              onSuccess: () => {
                pushToast("Asset deleted", "success");
                onDeleted();
              },
              onError: (error) => pushToast(error.message, "error"),
            });
          }}
          type="button"
        >
          Delete Asset
        </button>
      </div>

      {updateMutation.isSuccess ? <p className="message success">Saved</p> : null}

      <div style={{ marginTop: 12 }}>
        <AssetInformationalTable
          assetLevel={currentDetail?.asset_level ?? "enterprise"}
          disabled={createInfoMutation.isPending || updateInfoMutation.isPending || deleteInfoMutation.isPending}
          onCreate={(payload: InformationalFieldCreatePayload) => {
            if (!selectedAssetId) {
              return;
            }
            createInfoMutation.mutate(
              { assetId: selectedAssetId, payload },
              {
                onSuccess: () => pushToast("Asset informational field created", "success"),
                onError: (error) => pushToast(error.message, "error"),
              },
            );
          }}
          onDelete={(fieldId: string) => {
            if (!selectedAssetId || !window.confirm("Delete informational field?")) {
              return;
            }
            deleteInfoMutation.mutate(
              { assetId: selectedAssetId, fieldId },
              {
                onSuccess: () => pushToast("Asset informational field deleted", "success"),
                onError: (error) => pushToast(error.message, "error"),
              },
            );
          }}
          onUpdate={(fieldId: string, payload: InformationalFieldUpdatePayload) => {
            if (!selectedAssetId) {
              return;
            }
            updateInfoMutation.mutate(
              { assetId: selectedAssetId, fieldId, payload },
              {
                onSuccess: () => pushToast("Asset informational field updated", "success"),
                onError: (error) => pushToast(error.message, "error"),
              },
            );
          }}
          rows={currentDetail?.informational ?? []}
        />
      </div>
    </section>
  );
}

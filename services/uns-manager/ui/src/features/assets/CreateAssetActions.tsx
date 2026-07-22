import { useMemo, useState } from "react";

import { levelLabel, nextLevelForParent } from "../../shared/data/isa95";
import { validateAssetName } from "../../shared/validation/assetName";
import type { AssetLevel, CreateAssetFromTemplatePayload, CreateAssetPayload } from "./types";

type TemplateOption = {
  id: string;
  name: string;
  level: AssetLevel;
};

type SelectedParent = {
  id: string;
  name: string;
  level: AssetLevel;
} | null;

type CreateAssetActionsProps = {
  selectedParent: SelectedParent;
  templateOptions: TemplateOption[];
  onCreateManual: (payload: CreateAssetPayload) => void;
  onCreateFromTemplate: (payload: CreateAssetFromTemplatePayload) => void;
  disabled?: boolean;
};

export function CreateAssetActions({
  selectedParent,
  templateOptions,
  onCreateManual,
  onCreateFromTemplate,
  disabled = false,
}: CreateAssetActionsProps) {
  const [manualName, setManualName] = useState("");
  const [fromTemplateName, setFromTemplateName] = useState("");
  const [templateId, setTemplateId] = useState("");

  const parentLevel = selectedParent?.level ?? null;
  const targetLevel = nextLevelForParent(parentLevel);

  const availableTemplates = useMemo(() => {
    if (!targetLevel) {
      return [];
    }

    return templateOptions.filter((template) => template.level === targetLevel);
  }, [targetLevel, templateOptions]);

  const manualNameError = manualName.length > 0 ? validateAssetName(manualName) : null;
  const fromTemplateNameError = fromTemplateName.length > 0 ? validateAssetName(fromTemplateName) : null;

  const canCreateManual = Boolean(targetLevel && manualName.trim() && !manualNameError) && !disabled;
  const canCreateFromTemplate =
    Boolean(targetLevel && templateId && fromTemplateName.trim() && !fromTemplateNameError) && !disabled;

  return (
    <section className="panel">
      <h4 className="panel-title">Create Asset</h4>
      <p className="message muted" style={{ marginTop: 8 }}>
        Parent: {selectedParent ? `${selectedParent.name} (${selectedParent.level})` : "ROOT"}
      </p>
      <p className="message muted">Target level: {targetLevel ? levelLabel(targetLevel) : "No deeper level allowed"}</p>

      <div className="split-fields" style={{ marginTop: 10 }}>
        <div className="panel">
          <h5 className="panel-title">Manual</h5>
          <div className="field-group" style={{ marginTop: 8 }}>
            <label className="field-label" htmlFor="manual-asset-name">
              Name
            </label>
            <input
              className="field-input"
              id="manual-asset-name"
              onChange={(event) => setManualName(event.target.value)}
              value={manualName}
            />
            {manualNameError ? <p className="message error">{manualNameError}</p> : null}
          </div>
          <button
            className="button"
            disabled={!canCreateManual}
            onClick={() => {
              if (!targetLevel) {
                return;
              }
              onCreateManual({
                parent_id: selectedParent?.id ?? null,
                asset_level: targetLevel,
                name: manualName.trim(),
                descriptive: {},
                analytical: {},
              });
              setManualName("");
            }}
            type="button"
          >
            Create Manual
          </button>
        </div>

        <div className="panel">
          <h5 className="panel-title">From Template</h5>
          <div className="field-group" style={{ marginTop: 8 }}>
            <label className="field-label" htmlFor="template-select">
              Template
            </label>
            <select
              className="field-select"
              id="template-select"
              onChange={(event) => setTemplateId(event.target.value)}
              value={templateId}
            >
              <option value="">Select template</option>
              {availableTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="from-template-name">
              Asset Name
            </label>
            <input
              className="field-input"
              id="from-template-name"
              onChange={(event) => setFromTemplateName(event.target.value)}
              value={fromTemplateName}
            />
            {fromTemplateNameError ? <p className="message error">{fromTemplateNameError}</p> : null}
          </div>

          <button
            className="button"
            disabled={!canCreateFromTemplate}
            onClick={() => {
              onCreateFromTemplate({
                parent_id: selectedParent?.id ?? null,
                template_id: templateId,
                name: fromTemplateName.trim(),
                descriptive_overrides: {},
                analytical_overrides: {},
              });
              setFromTemplateName("");
              setTemplateId("");
            }}
            type="button"
          >
            Create from Template
          </button>
        </div>
      </div>
    </section>
  );
}

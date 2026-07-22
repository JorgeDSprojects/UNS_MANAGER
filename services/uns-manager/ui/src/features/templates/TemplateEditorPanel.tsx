import { useEffect, useMemo, useRef, useState } from "react";

import { nextLevelForParent } from "../../shared/data/isa95";
import { useDirtyGuard } from "../../shared/forms/useDirtyGuard";
import { formatJson, parseJsonInput } from "../../shared/forms/jsonEditor";
import { useToast } from "../../shared/ui/ToastProvider";
import { ErrorBanner } from "../../shared/ui/ErrorBanner";
import {
  useAddTemplateChildMutation,
  useCreateTemplateInformationalMutation,
  useDeleteTemplateChildMutation,
  useDeleteTemplateInformationalMutation,
  useDeleteTemplateMutation,
  useSaveTemplateMutation,
  useTemplateDetailQuery,
  useUpdateTemplateInformationalMutation,
} from "./hooks";
import { TemplateChildrenTable } from "./TemplateChildrenTable";
import { TemplateInformationalTable } from "./TemplateInformationalTable";
import type {
  InformationalFieldCreatePayload,
  InformationalFieldUpdatePayload,
  TemplateRecord,
  TemplateUpdatePayload,
} from "./types";

type TemplateEditorPanelProps = {
  selectedId: string | null;
  allTemplates: TemplateRecord[];
  onDeleted: () => void;
};

export function TemplateEditorPanel({ selectedId, allTemplates, onDeleted }: TemplateEditorPanelProps) {
  const detailQuery = useTemplateDetailQuery(selectedId);
  const saveMutation = useSaveTemplateMutation();
  const deleteMutation = useDeleteTemplateMutation();
  const addChildMutation = useAddTemplateChildMutation();
  const deleteChildMutation = useDeleteTemplateChildMutation();
  const createInfoMutation = useCreateTemplateInformationalMutation();
  const updateInfoMutation = useUpdateTemplateInformationalMutation();
  const deleteInfoMutation = useDeleteTemplateInformationalMutation();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const { pushToast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [descriptiveJson, setDescriptiveJson] = useState("{}");
  const [analyticalJson, setAnalyticalJson] = useState("{}");

  useEffect(() => {
    if (detailQuery.data) {
      setDisplayName(detailQuery.data.display_name ?? "");
      setDescription(detailQuery.data.description ?? "");
      setIcon(detailQuery.data.icon ?? "");
      setDescriptiveJson(formatJson(detailQuery.data.descriptive));
      setAnalyticalJson(formatJson(detailQuery.data.analytical));
    }
  }, [detailQuery.data]);

  const descriptiveParse = useMemo(() => parseJsonInput(descriptiveJson), [descriptiveJson]);
  const analyticalParse = useMemo(() => parseJsonInput(analyticalJson), [analyticalJson]);

  const currentDetail = detailQuery.data;
  const isDirty = Boolean(currentDetail) && (
    displayName !== (currentDetail.display_name ?? "") ||
    description !== (currentDetail.description ?? "") ||
    icon !== (currentDetail.icon ?? "") ||
    descriptiveJson !== formatJson(currentDetail.descriptive) ||
    analyticalJson !== formatJson(currentDetail.analytical)
  );
  const { confirmNavigation } = useDirtyGuard(isDirty);

  const canSave = Boolean(
    selectedId &&
      displayName.trim() &&
      descriptiveParse.ok &&
      analyticalParse.ok,
  );

  if (!selectedId) {
    return (
      <section className="panel">
        <h3 className="panel-title">Template Editor</h3>
        <p className="message muted">Select a template to edit metadata, payload and structure.</p>
      </section>
    );
  }

  const templateLevel = currentDetail?.level;
  const childTargetLevel = templateLevel ? nextLevelForParent(templateLevel) : null;
  const alreadyLinked = new Set((currentDetail?.children ?? []).map((child) => child.child_template_id));
  const childOptions = childTargetLevel
    ? allTemplates
        .filter((template) => template.level === childTargetLevel && !alreadyLinked.has(template.id))
        .map((template) => ({ id: template.id, name: template.name, level: template.level }))
    : [];

  const onSave = () => {
    if (!selectedId || !descriptiveParse.ok || !analyticalParse.ok) {
      return;
    }

    const payload: TemplateUpdatePayload = {
      display_name: displayName,
      description: description || null,
      icon: icon || null,
      descriptive: descriptiveParse.value,
      analytical: analyticalParse.value,
    };

    saveMutation.mutate(
      { id: selectedId, payload },
      {
        onSuccess: () => pushToast("Template saved", "success"),
        onError: (error) => pushToast(error.message, "error"),
      },
    );
  };

  const onDeleteTemplate = () => {
    if (!selectedId) {
      return;
    }
    if (!window.confirm("Delete selected template?")) {
      return;
    }

    deleteMutation.mutate(selectedId, {
      onSuccess: () => {
        pushToast("Template deleted", "success");
        onDeleted();
      },
      onError: (error) => pushToast(error.message, "error"),
    });
  };

  return (
    <section className="panel">
      <div className="inline-row" style={{ justifyContent: "space-between" }}>
        <h3 className="panel-title">Template Editor</h3>
        <span className="chip">{templateLevel ?? "unknown"}</span>
      </div>

      {detailQuery.isLoading ? <p className="message muted">Loading template...</p> : null}
      {detailQuery.isError ? <ErrorBanner message={detailQuery.error.message} /> : null}

      <div className="split-fields" style={{ marginTop: 10 }}>
        <div className="field-group">
          <label className="field-label" htmlFor="template-display-name">
            Display Name
          </label>
          <input
            className="field-input"
            id="template-display-name"
            onChange={(event) => setDisplayName(event.target.value)}
            value={displayName}
          />
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="template-icon">
            Icon
          </label>
          <input
            className="field-input"
            id="template-icon"
            onChange={(event) => setIcon(event.target.value)}
            value={icon}
          />
        </div>
      </div>

      <div className="field-group">
        <label className="field-label" htmlFor="template-description">
          Description
        </label>
        <textarea
          className="field-textarea"
          id="template-description"
          onChange={(event) => setDescription(event.target.value)}
          style={{ minHeight: 70 }}
          value={description}
        />
      </div>

      <div className="split-fields">
        <div className="field-group">
          <label className="field-label" htmlFor="template-descriptive">
            Descriptive (JSON)
          </label>
          <textarea
            className="field-textarea"
            id="template-descriptive"
            onChange={(event) => setDescriptiveJson(event.target.value)}
            value={descriptiveJson}
          />
          {!descriptiveParse.ok ? <p className="message error">{descriptiveParse.error}</p> : null}
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="template-analytical">
            Analytical (JSON)
          </label>
          <textarea
            className="field-textarea"
            id="template-analytical"
            onChange={(event) => setAnalyticalJson(event.target.value)}
            value={analyticalJson}
          />
          {!analyticalParse.ok ? <p className="message error">{analyticalParse.error}</p> : null}
        </div>
      </div>

      <div className="panel-toolbar">
        <button className="button" disabled={!canSave || saveMutation.isPending} onClick={onSave} type="button">
          Save
        </button>
        <button
          className="button secondary"
          onClick={() => {
            if (!confirmNavigation()) {
              return;
            }
            if (!currentDetail) {
              return;
            }
            setDisplayName(currentDetail.display_name ?? "");
            setDescription(currentDetail.description ?? "");
            setIcon(currentDetail.icon ?? "");
            setDescriptiveJson(formatJson(currentDetail.descriptive));
            setAnalyticalJson(formatJson(currentDetail.analytical));
          }}
          type="button"
        >
          Discard
        </button>
        <button
          className="button secondary"
          onClick={() => {
            if (!currentDetail) {
              return;
            }
            const blob = new Blob(
              [
                JSON.stringify(
                  {
                    level: currentDetail.level,
                    name: currentDetail.name,
                    display_name: displayName,
                    description,
                    icon,
                    descriptive: descriptiveParse.ok ? descriptiveParse.value : {},
                    analytical: analyticalParse.ok ? analyticalParse.value : {},
                  },
                  null,
                  2,
                ),
              ],
              { type: "application/json" },
            );
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `${currentDetail.name}.json`;
            anchor.click();
            URL.revokeObjectURL(url);
          }}
          type="button"
        >
          Export JSON
        </button>
        <button
          className="button secondary"
          onClick={() => importInputRef.current?.click()}
          type="button"
        >
          Import JSON
        </button>
        <input
          accept="application/json"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }
            const raw = await file.text();
            const parsed = parseJsonInput(raw);
            if (!parsed.ok) {
              pushToast("Import file must contain a JSON object", "error");
              return;
            }
            const imported = parsed.value;
            setDisplayName(typeof imported.display_name === "string" ? imported.display_name : displayName);
            setDescription(typeof imported.description === "string" ? imported.description : "");
            setIcon(typeof imported.icon === "string" ? imported.icon : "");
            if (imported.descriptive && typeof imported.descriptive === "object") {
              setDescriptiveJson(formatJson(imported.descriptive as Record<string, unknown>));
            }
            if (imported.analytical && typeof imported.analytical === "object") {
              setAnalyticalJson(formatJson(imported.analytical as Record<string, unknown>));
            }
            pushToast("Template JSON imported", "success");
          }}
          ref={importInputRef}
          style={{ display: "none" }}
          type="file"
        />
        <button className="button danger" onClick={onDeleteTemplate} type="button">
          Delete Template
        </button>
      </div>

      {saveMutation.isSuccess ? <p className="message success">Saved</p> : null}

      <div className="panel-grid" style={{ marginTop: 14 }}>
        <TemplateChildrenTable
          disabled={addChildMutation.isPending || deleteChildMutation.isPending}
          onAddChild={(payload) => {
            if (!selectedId) {
              return;
            }
            addChildMutation.mutate(
              { templateId: selectedId, payload },
              {
                onSuccess: () => pushToast("Child template linked", "success"),
                onError: (error) => pushToast(error.message, "error"),
              },
            );
          }}
          onDeleteChild={(childTemplateId) => {
            if (!selectedId || !window.confirm("Delete child relation?")) {
              return;
            }
            deleteChildMutation.mutate(
              { templateId: selectedId, childTemplateId },
              {
                onSuccess: () => pushToast("Child relation deleted", "success"),
                onError: (error) => pushToast(error.message, "error"),
              },
            );
          }}
          options={childOptions}
          rows={currentDetail?.children ?? []}
        />

        <TemplateInformationalTable
          disabled={createInfoMutation.isPending || updateInfoMutation.isPending || deleteInfoMutation.isPending}
          onCreate={(payload: InformationalFieldCreatePayload) => {
            if (!selectedId) {
              return;
            }
            createInfoMutation.mutate(
              { templateId: selectedId, payload },
              {
                onSuccess: () => pushToast("Informational field created", "success"),
                onError: (error) => pushToast(error.message, "error"),
              },
            );
          }}
          onDelete={(fieldId: string) => {
            if (!selectedId || !window.confirm("Delete informational field?")) {
              return;
            }
            deleteInfoMutation.mutate(
              { templateId: selectedId, fieldId },
              {
                onSuccess: () => pushToast("Informational field deleted", "success"),
                onError: (error) => pushToast(error.message, "error"),
              },
            );
          }}
          onUpdate={(fieldId: string, payload: InformationalFieldUpdatePayload) => {
            if (!selectedId) {
              return;
            }
            updateInfoMutation.mutate(
              { templateId: selectedId, fieldId, payload },
              {
                onSuccess: () => pushToast("Informational field updated", "success"),
                onError: (error) => pushToast(error.message, "error"),
              },
            );
          }}
          rows={currentDetail?.informational ?? []}
          templateLevel={templateLevel ?? "enterprise"}
        />
      </div>
    </section>
  );
}

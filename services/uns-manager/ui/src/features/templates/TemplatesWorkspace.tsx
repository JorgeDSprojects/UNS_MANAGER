import { useMemo, useState } from "react";

import { ISA95_LEVELS, levelLabel, type Isa95Level } from "../../shared/data/isa95";
import { useToast } from "../../shared/ui/ToastProvider";
import { ErrorBanner } from "../../shared/ui/ErrorBanner";
import { useCreateTemplateMutation, useTemplatesListQuery } from "./hooks";
import { TemplateEditorPanel } from "./TemplateEditorPanel";
import { TemplateListPanel } from "./TemplateListPanel";
import type { TemplateCreatePayload } from "./types";

function emptyTemplateCreatePayload(): TemplateCreatePayload {
  return {
    level: "enterprise",
    name: "",
    display_name: "",
    description: "",
    descriptive: {},
    analytical: {},
    icon: "",
  };
}

export function TemplatesWorkspace() {
  const templatesQuery = useTemplatesListQuery();
  const createTemplateMutation = useCreateTemplateMutation();
  const { pushToast } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createPayload, setCreatePayload] = useState<TemplateCreatePayload>(emptyTemplateCreatePayload());

  const templates = templatesQuery.data ?? [];
  const filteredTemplates = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return templates;
    }

    return templates.filter((template) => {
      const composed = `${template.name} ${template.display_name ?? ""}`.toLowerCase();
      return composed.includes(normalized);
    });
  }, [search, templates]);

  const groupedTemplates = useMemo(() => {
    const groups: Record<Isa95Level, typeof filteredTemplates> = {
      enterprise: [],
      site: [],
      area: [],
      equipment: [],
      subsystem: [],
    };

    for (const template of filteredTemplates) {
      groups[template.level].push(template);
    }

    return groups;
  }, [filteredTemplates]);

  const onCreateTemplate = () => {
    if (!createPayload.name.trim()) {
      pushToast("Template name is required", "error");
      return;
    }

    createTemplateMutation.mutate(createPayload, {
      onSuccess: (created) => {
        pushToast("Template created", "success");
        setSelectedId(created.id);
        setCreatePayload(emptyTemplateCreatePayload());
        setShowCreateForm(false);
      },
      onError: (error) => pushToast(error.message, "error"),
    });
  };

  if (templatesQuery.isLoading) {
    return <p className="message muted">Loading templates workspace...</p>;
  }

  if (templatesQuery.isError) {
    return <ErrorBanner message={templatesQuery.error.message} />;
  }

  return (
    <div className="panel-grid two-col">
      <TemplateListPanel
        groupedTemplates={groupedTemplates}
        onCreateClick={() => setShowCreateForm((current) => !current)}
        onSearch={setSearch}
        onSelect={setSelectedId}
        search={search}
        selectedId={selectedId}
      />

      <div className="panel-grid">
        {showCreateForm ? (
          <section className="panel">
            <h3 className="panel-title">Create Template</h3>
            <div className="split-fields" style={{ marginTop: 10 }}>
              <div className="field-group">
                <label className="field-label" htmlFor="new-template-level">
                  Level
                </label>
                <select
                  className="field-select"
                  id="new-template-level"
                  onChange={(event) =>
                    setCreatePayload((prev) => ({
                      ...prev,
                      level: event.target.value as Isa95Level,
                    }))
                  }
                  value={createPayload.level}
                >
                  {ISA95_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {levelLabel(level)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="new-template-name">
                  Name
                </label>
                <input
                  className="field-input"
                  id="new-template-name"
                  onChange={(event) => setCreatePayload((prev) => ({ ...prev, name: event.target.value }))}
                  value={createPayload.name}
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="new-template-display-name">
                Display Name
              </label>
              <input
                className="field-input"
                id="new-template-display-name"
                onChange={(event) =>
                  setCreatePayload((prev) => ({
                    ...prev,
                    display_name: event.target.value,
                  }))
                }
                value={createPayload.display_name}
              />
            </div>

            <div className="panel-toolbar">
              <button className="button" onClick={onCreateTemplate} type="button">
                Create Template
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  setCreatePayload(emptyTemplateCreatePayload());
                  setShowCreateForm(false);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        <TemplateEditorPanel
          allTemplates={templates}
          onDeleted={() => setSelectedId(null)}
          selectedId={selectedId}
        />
      </div>
    </div>
  );
}

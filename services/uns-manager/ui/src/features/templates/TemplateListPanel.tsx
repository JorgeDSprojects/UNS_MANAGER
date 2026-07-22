import { levelLabel, type Isa95Level } from "../../shared/data/isa95";

type TemplateListItem = {
  id: string;
  name: string;
  display_name: string;
  level: Isa95Level;
};

type TemplateListPanelProps = {
  groupedTemplates: Record<Isa95Level, TemplateListItem[]>;
  search: string;
  selectedId: string | null;
  onSearch: (value: string) => void;
  onSelect: (templateId: string) => void;
  onCreateClick: () => void;
};

export function TemplateListPanel({
  groupedTemplates,
  search,
  selectedId,
  onSearch,
  onSelect,
  onCreateClick,
}: TemplateListPanelProps) {
  return (
    <section className="panel">
      <h3 className="panel-title">Template Catalog</h3>

      <div className="panel-toolbar">
        <input
          aria-label="Search Templates"
          className="field-input"
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search by name or display name"
          value={search}
        />
        <button className="button" onClick={onCreateClick} type="button">
          New Template
        </button>
      </div>

      {(["enterprise", "site", "area", "equipment", "subsystem"] as const).map((level) => {
        const items = groupedTemplates[level];
        if (items.length === 0) {
          return null;
        }

        return (
          <div className="level-group" key={level}>
            <h4 className="level-group-title">
              {levelLabel(level)} ({items.length})
            </h4>
            {items.map((template) => (
              <button
                className={`list-button${selectedId === template.id ? " active" : ""}`}
                key={template.id}
                onClick={() => onSelect(template.id)}
                type="button"
              >
                <strong>{template.name}</strong>
                <div className="muted">{template.display_name || "No display name"}</div>
              </button>
            ))}
          </div>
        );
      })}
    </section>
  );
}

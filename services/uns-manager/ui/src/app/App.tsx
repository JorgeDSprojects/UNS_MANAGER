import { useMemo, useState } from "react";

import { AssetsWorkspace } from "../features/assets/AssetsWorkspace";
import { StatusSyncContainer } from "../features/status-sync/StatusSyncContainer";
import { useStatusSyncQuery } from "../features/status-sync/hooks";
import { TemplatesWorkspace } from "../features/templates/TemplatesWorkspace";

type ViewTab = "templates" | "assets";

export default function App() {
  const [activeTab, setActiveTab] = useState<ViewTab>("templates");
  const statusQuery = useStatusSyncQuery();
  const metrics = useMemo(
    () => ({
      templates: statusQuery.data?.templates_count ?? 0,
      assets: statusQuery.data?.assets_count ?? 0,
      fields: statusQuery.data?.informational_fields_count ?? 0,
    }),
    [statusQuery.data],
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">UNS Manager</h1>
          <nav className="flex gap-2">
            <button
              className={activeTab === "templates" ? "font-semibold" : "text-slate-600"}
              onClick={() => setActiveTab("templates")}
              type="button"
            >
              Templates
            </button>
            <button
              className={activeTab === "assets" ? "font-semibold" : "text-slate-600"}
              onClick={() => setActiveTab("assets")}
              type="button"
            >
              Assets
            </button>
          </nav>
        </div>
        <StatusSyncContainer />
      </header>

      <main className="p-4">
        <section className="rounded border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold tracking-wide text-slate-700">
            {activeTab === "templates" ? "TEMPLATES" : "ASSETS"}
          </h2>
          <div className="mt-3">
            {activeTab === "templates" ? <TemplatesWorkspace /> : <AssetsWorkspace />}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
        Templates: {metrics.templates} | Assets: {metrics.assets} | Fields: {metrics.fields}
      </footer>
    </div>
  );
}

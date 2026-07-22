import { apiClient } from "../../shared/api/client";

import type { InformationalField, TemplateChild, TemplateRecord, TemplateUpdatePayload } from "./types";

export async function fetchTemplates(level?: string): Promise<TemplateRecord[]> {
  const params = level ? `?level=${encodeURIComponent(level)}` : "";
  return apiClient<TemplateRecord[]>(`/api/v1/templates${params}`);
}

export async function fetchTemplateDetail(templateId: string): Promise<TemplateRecord> {
  return apiClient<TemplateRecord>(`/api/v1/templates/${templateId}`);
}

export async function createTemplate(payload: Omit<TemplateRecord, "id" | "created_at" | "updated_at">) {
  return apiClient<TemplateRecord>("/api/v1/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTemplate(templateId: string, payload: TemplateUpdatePayload): Promise<TemplateRecord> {
  return apiClient<TemplateRecord>(`/api/v1/templates/${templateId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await apiClient<unknown>(`/api/v1/templates/${templateId}`, { method: "DELETE" });
}

export async function fetchTemplateChildren(templateId: string): Promise<TemplateChild[]> {
  return apiClient<TemplateChild[]>(`/api/v1/templates/${templateId}/children`);
}

export async function fetchTemplateInformational(templateId: string): Promise<InformationalField[]> {
  return apiClient<InformationalField[]>(`/api/v1/templates/${templateId}/informational`);
}

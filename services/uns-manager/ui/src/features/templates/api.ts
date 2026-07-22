import { apiClient } from "../../shared/api/client";

import type {
  InformationalField,
  InformationalFieldCreatePayload,
  InformationalFieldUpdatePayload,
  TemplateChild,
  TemplateChildCreatePayload,
  TemplateCreatePayload,
  TemplateRecord,
  TemplateUpdatePayload,
} from "./types";

export async function fetchTemplates(level?: string): Promise<TemplateRecord[]> {
  const params = level ? `?level=${encodeURIComponent(level)}` : "";
  return apiClient<TemplateRecord[]>(`/api/v1/templates${params}`);
}

export async function fetchTemplateDetail(templateId: string): Promise<TemplateRecord> {
  return apiClient<TemplateRecord>(`/api/v1/templates/${templateId}`);
}

export async function createTemplate(payload: TemplateCreatePayload): Promise<TemplateRecord> {
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
  await apiClient<void>(`/api/v1/templates/${templateId}`, { method: "DELETE" });
}

export async function fetchTemplateChildren(templateId: string): Promise<TemplateChild[]> {
  return apiClient<TemplateChild[]>(`/api/v1/templates/${templateId}/children`);
}

export async function addTemplateChild(
  templateId: string,
  payload: TemplateChildCreatePayload,
): Promise<TemplateChild> {
  return apiClient<TemplateChild>(`/api/v1/templates/${templateId}/children`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteTemplateChild(templateId: string, childTemplateId: string): Promise<void> {
  await apiClient<void>(`/api/v1/templates/${templateId}/children/${childTemplateId}`, {
    method: "DELETE",
  });
}

export async function fetchTemplateInformational(templateId: string): Promise<InformationalField[]> {
  return apiClient<InformationalField[]>(`/api/v1/templates/${templateId}/informational`);
}

export async function createTemplateInformational(
  templateId: string,
  payload: InformationalFieldCreatePayload,
): Promise<InformationalField> {
  return apiClient<InformationalField>(`/api/v1/templates/${templateId}/informational`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTemplateInformational(
  fieldId: string,
  payload: InformationalFieldUpdatePayload,
): Promise<InformationalField> {
  return apiClient<InformationalField>(`/api/v1/templates/informational/${fieldId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteTemplateInformational(fieldId: string): Promise<void> {
  await apiClient<void>(`/api/v1/templates/informational/${fieldId}`, {
    method: "DELETE",
  });
}

import { apiClient } from "../../shared/api/client";

import type {
  AssetInformationalField,
  AssetRecord,
  CreateAssetFromTemplatePayload,
  CreateAssetPayload,
  InformationalFieldCreatePayload,
  InformationalFieldUpdatePayload,
  UpdateAssetPayload,
} from "./types";

export async function fetchAssetsTree(): Promise<AssetRecord[]> {
  return apiClient<AssetRecord[]>("/api/v1/tree");
}

export async function fetchAssetDetail(assetId: string): Promise<AssetRecord> {
  return apiClient<AssetRecord>(`/api/v1/assets/${assetId}`);
}

export async function createAsset(payload: CreateAssetPayload): Promise<AssetRecord> {
  return apiClient<AssetRecord>("/api/v1/assets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createAssetFromTemplate(payload: CreateAssetFromTemplatePayload): Promise<AssetRecord> {
  return apiClient<AssetRecord>("/api/v1/assets/from-template", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAsset(assetId: string, payload: UpdateAssetPayload): Promise<AssetRecord> {
  return apiClient<AssetRecord>(`/api/v1/assets/${assetId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAsset(assetId: string): Promise<void> {
  await apiClient<void>(`/api/v1/assets/${assetId}`, {
    method: "DELETE",
  });
}

export async function fetchAssetInformational(assetId: string): Promise<AssetInformationalField[]> {
  return apiClient<AssetInformationalField[]>(`/api/v1/assets/${assetId}/informational`);
}

export async function createAssetInformational(
  assetId: string,
  payload: InformationalFieldCreatePayload,
): Promise<AssetInformationalField> {
  return apiClient<AssetInformationalField>(`/api/v1/assets/${assetId}/informational`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAssetInformational(
  fieldId: string,
  payload: InformationalFieldUpdatePayload,
): Promise<AssetInformationalField> {
  return apiClient<AssetInformationalField>(`/api/v1/informational/${fieldId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAssetInformational(fieldId: string): Promise<void> {
  await apiClient<void>(`/api/v1/informational/${fieldId}`, {
    method: "DELETE",
  });
}

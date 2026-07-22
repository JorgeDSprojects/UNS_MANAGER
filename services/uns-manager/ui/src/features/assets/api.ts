import { apiClient } from "../../shared/api/client";

import type {
  AssetRecord,
  CreateAssetFromTemplatePayload,
  CreateAssetPayload,
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
  await apiClient<unknown>(`/api/v1/assets/${assetId}`, {
    method: "DELETE",
  });
}

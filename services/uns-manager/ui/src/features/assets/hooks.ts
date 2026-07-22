import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";

import {
  createAsset,
  createAssetFromTemplate,
  deleteAsset,
  fetchAssetDetail,
  fetchAssetsTree,
  updateAsset,
} from "./api";
import type {
  AssetRecord,
  CreateAssetFromTemplatePayload,
  CreateAssetPayload,
  UpdateAssetPayload,
} from "./types";

export function useAssetsTreeQuery(): UseQueryResult<AssetRecord[], Error> {
  return useQuery({
    queryKey: ["assets-tree"],
    queryFn: fetchAssetsTree,
    retry: false,
  });
}

export function useAssetDetailQuery(assetId: string | null): UseQueryResult<AssetRecord, Error> {
  return useQuery({
    queryKey: ["asset-detail", assetId],
    queryFn: () => fetchAssetDetail(assetId as string),
    enabled: Boolean(assetId),
    retry: false,
  });
}

export function useCreateAssetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAssetPayload) => createAsset(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["assets-tree"] });
    },
  });
}

export function useCreateFromTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAssetFromTemplatePayload) => createAssetFromTemplate(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["assets-tree"] });
    },
  });
}

type UpdateAssetVariables = {
  id: string;
  payload: UpdateAssetPayload;
};

export function useUpdateAssetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: UpdateAssetVariables) => updateAsset(id, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["assets-tree"] });
      void queryClient.invalidateQueries({ queryKey: ["asset-detail", variables.id] });
    },
  });
}

export function useDeleteAssetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assetId: string) => deleteAsset(assetId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["assets-tree"] });
    },
  });
}

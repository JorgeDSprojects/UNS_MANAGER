import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";

import {
  createAsset,
  createAssetFromTemplate,
  createAssetInformational,
  deleteAsset,
  deleteAssetInformational,
  fetchAssetDetail,
  fetchAssetInformational,
  fetchAssetsTree,
  updateAsset,
  updateAssetInformational,
} from "./api";
import type {
  AssetInformationalField,
  AssetRecord,
  CreateAssetFromTemplatePayload,
  CreateAssetPayload,
  InformationalFieldCreatePayload,
  InformationalFieldUpdatePayload,
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

export function useAssetInformationalQuery(
  assetId: string | null,
): UseQueryResult<AssetInformationalField[], Error> {
  return useQuery({
    queryKey: ["asset-informational", assetId],
    queryFn: () => fetchAssetInformational(assetId as string),
    enabled: Boolean(assetId),
    retry: false,
  });
}

export function useCreateAssetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAssetPayload) => createAsset(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["assets-tree"], exact: false });
    },
  });
}

export function useCreateFromTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAssetFromTemplatePayload) => createAssetFromTemplate(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["assets-tree"], exact: false });
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
      void queryClient.invalidateQueries({ queryKey: ["assets-tree"], exact: false });
      void queryClient.invalidateQueries({ queryKey: ["asset-detail", variables.id] });
    },
  });
}

export function useDeleteAssetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assetId: string) => deleteAsset(assetId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["assets-tree"], exact: false });
    },
  });
}

type CreateInformationalVariables = {
  assetId: string;
  payload: InformationalFieldCreatePayload;
};

export function useCreateAssetInformationalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ assetId, payload }: CreateInformationalVariables) => createAssetInformational(assetId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["asset-detail", variables.assetId] });
      void queryClient.invalidateQueries({ queryKey: ["asset-informational", variables.assetId] });
    },
  });
}

type UpdateInformationalVariables = {
  assetId: string;
  fieldId: string;
  payload: InformationalFieldUpdatePayload;
};

export function useUpdateAssetInformationalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ fieldId, payload }: UpdateInformationalVariables) => updateAssetInformational(fieldId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["asset-detail", variables.assetId] });
      void queryClient.invalidateQueries({ queryKey: ["asset-informational", variables.assetId] });
    },
  });
}

type DeleteInformationalVariables = {
  assetId: string;
  fieldId: string;
};

export function useDeleteAssetInformationalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ fieldId }: DeleteInformationalVariables) => deleteAssetInformational(fieldId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["asset-detail", variables.assetId] });
      void queryClient.invalidateQueries({ queryKey: ["asset-informational", variables.assetId] });
    },
  });
}

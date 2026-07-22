import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";

import {
  addTemplateChild,
  createTemplate,
  createTemplateInformational,
  deleteTemplate,
  deleteTemplateChild,
  deleteTemplateInformational,
  fetchTemplateDetail,
  fetchTemplates,
  updateTemplate,
  updateTemplateInformational,
} from "./api";
import type {
  InformationalFieldCreatePayload,
  InformationalFieldUpdatePayload,
  TemplateChildCreatePayload,
  TemplateCreatePayload,
  TemplateRecord,
  TemplateUpdatePayload,
} from "./types";

export function useTemplatesListQuery(level?: string): UseQueryResult<TemplateRecord[], Error> {
  return useQuery({
    queryKey: ["templates", level ?? "all"],
    queryFn: () => fetchTemplates(level),
    retry: false,
  });
}

export function useTemplateDetailQuery(templateId: string | null): UseQueryResult<TemplateRecord, Error> {
  return useQuery({
    queryKey: ["template-detail", templateId],
    queryFn: () => fetchTemplateDetail(templateId as string),
    enabled: Boolean(templateId),
    retry: false,
  });
}

type SaveTemplateVariables = {
  id: string;
  payload: TemplateUpdatePayload;
};

export function useSaveTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: SaveTemplateVariables) => updateTemplate(id, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["templates"], exact: false });
      void queryClient.invalidateQueries({ queryKey: ["template-detail", variables.id] });
    },
  });
}

export function useCreateTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TemplateCreatePayload) => createTemplate(payload),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["templates"], exact: false });
      void queryClient.invalidateQueries({ queryKey: ["template-detail", created.id] });
    },
  });
}

export function useDeleteTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: string) => deleteTemplate(templateId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["templates"], exact: false });
    },
  });
}

type AddChildVariables = {
  templateId: string;
  payload: TemplateChildCreatePayload;
};

export function useAddTemplateChildMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, payload }: AddChildVariables) => addTemplateChild(templateId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["template-detail", variables.templateId] });
    },
  });
}

type DeleteChildVariables = {
  templateId: string;
  childTemplateId: string;
};

export function useDeleteTemplateChildMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, childTemplateId }: DeleteChildVariables) =>
      deleteTemplateChild(templateId, childTemplateId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["template-detail", variables.templateId] });
    },
  });
}

type CreateInformationalVariables = {
  templateId: string;
  payload: InformationalFieldCreatePayload;
};

export function useCreateTemplateInformationalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, payload }: CreateInformationalVariables) =>
      createTemplateInformational(templateId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["template-detail", variables.templateId] });
    },
  });
}

type UpdateInformationalVariables = {
  templateId: string;
  fieldId: string;
  payload: InformationalFieldUpdatePayload;
};

export function useUpdateTemplateInformationalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ fieldId, payload }: UpdateInformationalVariables) => updateTemplateInformational(fieldId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["template-detail", variables.templateId] });
    },
  });
}

type DeleteInformationalVariables = {
  templateId: string;
  fieldId: string;
};

export function useDeleteTemplateInformationalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ fieldId }: DeleteInformationalVariables) => deleteTemplateInformational(fieldId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["template-detail", variables.templateId] });
    },
  });
}

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";

import { fetchTemplateDetail, fetchTemplates, updateTemplate } from "./api";
import type { TemplateRecord, TemplateUpdatePayload } from "./types";

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
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
      void queryClient.invalidateQueries({ queryKey: ["template-detail", variables.id] });
    },
  });
}

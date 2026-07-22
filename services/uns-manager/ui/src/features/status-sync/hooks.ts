import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { fetchStatusSync } from "./api";
import type { StatusResponse } from "./types";

export function useStatusSyncQuery(): UseQueryResult<StatusResponse, Error> {
  return useQuery({
    queryKey: ["status-sync"],
    queryFn: fetchStatusSync,
    refetchInterval: 5000,
  });
}

import { apiClient } from "../../shared/api/client";

import type { StatusResponse } from "./types";

export async function fetchStatusSync(): Promise<StatusResponse> {
  return apiClient<StatusResponse>("/api/v1/status");
}

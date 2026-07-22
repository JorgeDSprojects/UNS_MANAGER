import { render } from "@testing-library/react";

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(() => ({ data: undefined })),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: mockUseQuery,
  };
});

import { useStatusSyncQuery } from "../features/status-sync/hooks";

function HookProbe() {
  useStatusSyncQuery();
  return null;
}

test("configures status polling every 5 seconds", () => {
  render(<HookProbe />);

  expect(mockUseQuery).toHaveBeenCalledTimes(1);
  const firstCallArg = mockUseQuery.mock.calls[0][0] as { refetchInterval?: number };
  expect(firstCallArg.refetchInterval).toBe(5000);
});

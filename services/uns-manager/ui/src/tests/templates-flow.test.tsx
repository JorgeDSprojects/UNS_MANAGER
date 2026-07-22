import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TemplatesWorkspace } from "../features/templates/TemplatesWorkspace";

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("edits display_name and saves template", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.endsWith("/api/v1/templates") && method === "GET") {
      return jsonResponse([
        {
          id: "tpl-1",
          level: "equipment",
          name: "VESTAS_V90_2MW",
          display_name: "Vestas V90",
          description: null,
          descriptive: {},
          analytical: {},
          icon: null,
          children: [],
          informational: [],
          created_at: "2026-07-22T00:00:00Z",
          updated_at: "2026-07-22T00:00:00Z",
        },
      ]);
    }

    if (url.endsWith("/api/v1/templates/tpl-1") && method === "GET") {
      return jsonResponse({
        id: "tpl-1",
        level: "equipment",
        name: "VESTAS_V90_2MW",
        display_name: "Vestas V90",
        description: null,
        descriptive: {},
        analytical: {},
        icon: null,
        children: [],
        informational: [],
        created_at: "2026-07-22T00:00:00Z",
        updated_at: "2026-07-22T00:00:00Z",
      });
    }

    if (url.endsWith("/api/v1/templates/tpl-1") && method === "PUT") {
      return jsonResponse({
        id: "tpl-1",
        level: "equipment",
        name: "VESTAS_V90_2MW",
        display_name: "Vestas V90 Updated",
        description: null,
        descriptive: {},
        analytical: {},
        icon: null,
        children: [],
        informational: [],
        created_at: "2026-07-22T00:00:00Z",
        updated_at: "2026-07-22T00:00:00Z",
      });
    }

    return new Response("Not found", { status: 404 });
  });

  vi.stubGlobal("fetch", fetchMock);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <TemplatesWorkspace />
    </QueryClientProvider>,
  );

  await user.click(await screen.findByText("VESTAS_V90_2MW"));
  const input = await screen.findByLabelText("Display Name");
  await user.clear(input);
  await user.type(input, "Vestas V90 Updated");
  await user.click(screen.getByRole("button", { name: "Save" }));

  expect(await screen.findByText("Saved")).toBeInTheDocument();
});

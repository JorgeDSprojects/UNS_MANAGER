import { parseJsonInput } from "../shared/forms/jsonEditor";

test("parses valid json object", () => {
  const parsed = parseJsonInput('{"plant":"north"}');

  expect(parsed.ok).toBe(true);
  if (parsed.ok) {
    expect(parsed.value).toEqual({ plant: "north" });
  }
});

test("rejects json arrays", () => {
  const parsed = parseJsonInput("[]");

  expect(parsed.ok).toBe(false);
  if (!parsed.ok) {
    expect(parsed.error).toContain("JSON object");
  }
});

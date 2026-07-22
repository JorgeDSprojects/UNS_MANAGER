import { validateAssetName } from "../shared/validation/assetName";

test("rejects lowercase names", () => {
  expect(validateAssetName("site_a")).toContain("^[A-Z0-9_]+$");
});

test("accepts uppercase underscore names", () => {
  expect(validateAssetName("SITE_A")).toBeNull();
});

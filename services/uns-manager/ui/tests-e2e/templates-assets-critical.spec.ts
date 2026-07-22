import { expect, test } from "@playwright/test";

test("templates and assets critical flow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Templates" }).click();
  await expect(page.getByRole("heading", { name: "TEMPLATES" })).toBeVisible();
  await page.getByRole("button", { name: "Assets" }).click();
  await expect(page.getByText("ISA-95")).toBeVisible();
});

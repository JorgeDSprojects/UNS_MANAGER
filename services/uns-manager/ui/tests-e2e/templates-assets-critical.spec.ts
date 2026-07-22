import { expect, test } from "@playwright/test";

test("templates and assets critical flow", async ({ page, request }) => {
  const suffix = Date.now().toString().slice(-6);
  const templateName = `E2E_SITE_TPL_${suffix}`;
  const enterpriseName = `E2E_ENT_${suffix}`;
  const siteFromTemplateName = `E2E_SITE_${suffix}`;

  const templateResponse = await request.post("/api/v1/templates", {
    data: {
      level: "site",
      name: templateName,
      display_name: "E2E Site Template",
      descriptive: { region: "north" },
      analytical: {},
    },
  });
  expect(templateResponse.ok()).toBeTruthy();

  const enterpriseResponse = await request.post("/api/v1/assets", {
    data: {
      asset_level: "enterprise",
      name: enterpriseName,
      descriptive: {},
      analytical: {},
    },
  });
  expect(enterpriseResponse.ok()).toBeTruthy();

  await page.goto("/");

  await page.getByRole("button", { name: "Templates" }).click();
  await expect(page.getByRole("heading", { name: "Templates" })).toBeVisible();

  await page.getByLabel("Search Templates").fill(templateName);
  await page.getByRole("button", { name: new RegExp(templateName) }).click();

  await page.getByLabel("Display Name").fill("E2E Updated Display Name");
  await page.getByRole("button", { name: "Save" }).first().click();
  await expect(page.getByText("Template saved")).toBeVisible();

  await page.getByRole("button", { name: "Assets" }).click();
  await expect(page.getByRole("heading", { name: "Assets" })).toBeVisible();

  await page.getByRole("button", { name: enterpriseName }).first().click();
  await page.getByLabel("Template").selectOption({ label: templateName });
  await page.locator("#from-template-name").fill(siteFromTemplateName);
  await page.getByRole("button", { name: "Create from Template" }).click();

  await expect(page.getByRole("button", { name: siteFromTemplateName }).first()).toBeVisible();
});

import { test, expect } from "@playwright/test";

test.describe("Dashboard smoke", () => {
  test("carrega e mostra cartões", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Valor Faturado")).toBeVisible();
  });
});

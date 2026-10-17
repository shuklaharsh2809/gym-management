import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { assignDistinctClientIp, registerAndOnboard, uniqueEmail } from "./helpers";

async function axe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s) – ${v.help}`);
}

test("public pages have no WCAG A/AA violations", async ({ page }) => {
  for (const path of ["/", "/pricing", "/contact", "/login", "/register"]) {
    await page.goto(path);
    expect(await axe(page), path).toEqual([]);
  }
});

test("core app screens have no WCAG A/AA violations", async ({ page }) => {
  test.setTimeout(90_000);
  await registerAndOnboard(page, {
    name: "Axe Owner",
    email: uniqueEmail("axe"),
    organization: "Access Gym",
    branch: "Main",
  });
  for (const path of [
    "/app",
    "/app/members",
    "/app/members/new",
    "/app/front-desk?q=zz",
    "/app/plans/new",
    "/app/finance/invoices",
    "/app/reports",
    "/app/organization/team",
  ]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await axe(page), path).toEqual([]);
  }
});

test("platform administration is hidden from organization users", async ({ page }) => {
  await registerAndOnboard(page, {
    name: "Not Admin",
    email: uniqueEmail("notadmin"),
    organization: "Normal Gym",
    branch: "Main",
  });
  const response = await page.goto("/platform/organizations");
  expect(response?.status()).toBe(404);
});

test("the public contact form stores an enquiry", async ({ page }) => {
  await assignDistinctClientIp(page);
  await page.goto("/contact");
  await page.getByLabel("Name", { exact: true }).fill("Prospect Person");
  await page.getByLabel("Work email").fill(uniqueEmail("lead"));
  await page.getByLabel("How can we help?").fill("We run three gyms and want a demo.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/get back to you/)).toBeVisible();
});

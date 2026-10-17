import { expect, type Page } from "@playwright/test";

export function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@e2e.test`;
}

/**
 * Give each simulated person their own client IP. Better Auth rate-limits sign-ups per IP
 * (from x-forwarded-for), and the limit stays enabled in E2E runs.
 */
export async function assignDistinctClientIp(page: Page) {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
}

export async function registerAndOnboard(
  page: Page,
  opts: { name: string; email: string; organization: string; branch: string },
) {
  await assignDistinctClientIp(page);
  await page.goto("/register");
  await page.getByLabel("Full name").fill(opts.name);
  await page.getByLabel("Work email").fill(opts.email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Business name").fill(opts.organization);
  await page.getByLabel("Branch name").fill(opts.branch);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

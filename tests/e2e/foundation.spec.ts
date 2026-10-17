import { expect, test } from "@playwright/test";
import { registerAndOnboard, uniqueEmail } from "./helpers";

test("redirects anonymous visitors away from the app", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
});

test("account → organization → branch, with audit history", async ({ page }) => {
  await registerAndOnboard(page, {
    name: "Asha Rao",
    email: uniqueEmail("asha"),
    organization: "Pulse Athletics",
    branch: "Indiranagar",
  });

  await expect(page.getByRole("heading", { name: "Welcome back, Asha" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Organization: Pulse Athletics/ })).toBeVisible();
  await page.goto("/app/organization/branches");
  await expect(page.getByRole("link", { name: "Indiranagar" })).toBeVisible();

  // Validation errors keep the user's input.
  await page.getByRole("link", { name: "Branches" }).first().click();
  await page.getByRole("link", { name: "Add branch" }).click();
  await page.getByLabel("Branch name").fill("W");
  await page.getByLabel("City").fill("Bengaluru");
  await page.getByRole("button", { name: "Create branch" }).click();
  await expect(page.getByText("Branch name must be at least 2 characters")).toBeVisible();
  await expect(page.getByLabel("City")).toHaveValue("Bengaluru");

  await page.getByLabel("Branch name").fill("Whitefield");
  await page.getByRole("button", { name: "Create branch" }).click();
  await expect(page.getByText("Branch created.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Whitefield" })).toBeVisible();

  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  const activity = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Recent activity" }) });
  await expect(activity).toContainText("created the organization");
  await expect(activity.getByText("added a branch")).toHaveCount(2);
});

test("a user cannot open another organization's branch", async ({ browser }) => {
  const owner = await browser.newPage();
  await registerAndOnboard(owner, {
    name: "Owner One",
    email: uniqueEmail("one"),
    organization: "Tenant One",
    branch: "Secret Branch",
  });
  await owner.goto("/app/organization/branches");
  await owner.getByRole("link", { name: "Secret Branch" }).click();
  await expect(owner.getByRole("heading", { name: "Secret Branch" })).toBeVisible();
  const branchUrl = owner.url();

  const intruderContext = await browser.newContext();
  const intruder = await intruderContext.newPage();
  await registerAndOnboard(intruder, {
    name: "Owner Two",
    email: uniqueEmail("two"),
    organization: "Tenant Two",
    branch: "Main",
  });
  await intruder.goto(branchUrl);
  await expect(intruder.getByRole("heading", { name: "Not found" })).toBeVisible();
  await expect(intruder.getByText("Secret Branch")).toHaveCount(0);
  await intruderContext.close();
});

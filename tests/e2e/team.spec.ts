import { expect, test } from "@playwright/test";
import { registerAndOnboard, uniqueEmail, assignDistinctClientIp } from "./helpers";

test("invite a branch manager, restrict them to one branch, then suspend them", async ({
  browser,
}) => {
  // Owner sets up two branches.
  const owner = await browser.newPage();
  await registerAndOnboard(owner, {
    name: "Nadia Owner",
    email: uniqueEmail("nadia"),
    organization: "Core Collective",
    branch: "Main Street",
  });
  await owner.getByRole("link", { name: "Main Street" }).click();
  await expect(owner.getByRole("heading", { name: "Main Street" })).toBeVisible();
  const mainBranchUrl = owner.url();
  await owner.goto("/app/organization/branches/new");
  await owner.getByLabel("Branch name").fill("Riverside");
  await owner.getByRole("button", { name: "Create branch" }).click();
  await expect(owner.getByText("Branch created.")).toBeVisible();

  // Invite a manager for Riverside only.
  const managerEmail = uniqueEmail("manager");
  await owner.goto("/app/organization/team");
  await owner.getByRole("link", { name: "Invite member" }).click();
  await owner.getByLabel("Email address").fill(managerEmail);
  await owner.getByLabel("Role").selectOption("BRANCH_MANAGER");
  await owner.getByLabel("Riverside").check();
  await owner.getByRole("button", { name: "Create invitation" }).click();
  await expect(owner.getByRole("heading", { name: "Invitation created" })).toBeVisible();
  const inviteUrl = await owner.getByLabel("Invitation link").inputValue();
  expect(inviteUrl).toMatch(/\/invite\/[\w-]{43}$/);

  // The manager accepts by creating an account (email is pre-filled).
  const managerContext = await browser.newContext();
  const manager = await managerContext.newPage();
  await assignDistinctClientIp(manager);
  await manager.goto(inviteUrl);
  await expect(manager.getByRole("heading", { name: "Join Core Collective" })).toBeVisible();
  await manager.getByRole("link", { name: "Create account and join" }).click();
  await expect(manager.getByLabel("Work email")).toHaveValue(managerEmail);
  await manager.getByLabel("Full name").fill("Omar Manager");
  await manager.getByLabel("Password").fill("correct-horse-battery");
  await manager.getByRole("button", { name: "Create account" }).click();
  await expect(manager).toHaveURL(/\/invite\//);
  await manager.getByRole("button", { name: "Accept invitation" }).click();
  await expect(manager).toHaveURL(/\/app$/);

  // Only Riverside is visible; Main Street is not reachable by URL.
  await expect(manager.getByRole("button", { name: /Branch: Riverside/ })).toBeVisible();
  await expect(manager.getByRole("link", { name: "Riverside" })).toBeVisible();
  await expect(manager.getByRole("link", { name: "Main Street" })).toHaveCount(0);
  await manager.goto(new URL(mainBranchUrl).pathname);
  await expect(manager.getByRole("heading", { name: "Not found" })).toBeVisible();

  // The used link can't be reused.
  await manager.goto(inviteUrl);
  await expect(manager.getByRole("heading", { name: "Invitation already used" })).toBeVisible();

  // Owner suspends the manager; access ends on the manager's next request.
  await owner.goto("/app/organization/team");
  await owner.getByRole("link", { name: "Omar Manager" }).click();
  await owner.getByRole("button", { name: "Suspend access" }).click();
  await expect(owner.getByText("Member suspended.")).toBeVisible();

  await manager.goto("/app");
  await expect(manager).toHaveURL(/\/onboarding$/);

  // The audit log records the whole story.
  await owner.goto("/app/settings/audit-logs");
  for (const text of [
    "Invited a team member",
    "Accepted an invitation",
    "Suspended a team member",
  ]) {
    await expect(owner.getByRole("cell", { name: text })).toBeVisible();
  }
  await managerContext.close();
});

test("an invitation can't be accepted by a different signed-in account", async ({ browser }) => {
  const owner = await browser.newPage();
  await registerAndOnboard(owner, {
    name: "Ivy Owner",
    email: uniqueEmail("ivy"),
    organization: "Lift Lab",
    branch: "Central",
  });
  await owner.goto("/app/organization/team/invite");
  await owner.getByLabel("Email address").fill(uniqueEmail("intended"));
  await owner.getByLabel("Role").selectOption("ACCOUNTANT");
  await owner.getByRole("radio", { name: /^All branches/ }).check();
  await owner.getByRole("button", { name: "Create invitation" }).click();
  const inviteUrl = await owner.getByLabel("Invitation link").inputValue();

  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await registerAndOnboard(other, {
    name: "Someone Else",
    email: uniqueEmail("else"),
    organization: "Elsewhere",
    branch: "Only",
  });
  await other.goto(inviteUrl);
  await expect(other.getByText(/This invitation is for/)).toBeVisible();
  await expect(other.getByRole("button", { name: "Accept invitation" })).toHaveCount(0);
  await otherContext.close();
});

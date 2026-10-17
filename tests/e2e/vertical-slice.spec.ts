import { expect, test } from "@playwright/test";
import { assignDistinctClientIp, registerAndOnboard, uniqueEmail } from "./helpers";

/** Specification §12: the first end-to-end product demonstration. */
test("account → organization → branch → invite → member → plan → payment → check-in → dashboard & audit", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const owner = await browser.newPage();
  await registerAndOnboard(owner, {
    name: "Vikram Owner",
    email: uniqueEmail("vikram"),
    organization: "Peak Performance",
    branch: "Powai",
  });

  // Invite a branch manager for Powai and accept.
  await owner.goto("/app/organization/team/invite");
  const managerEmail = uniqueEmail("mgr");
  await owner.getByLabel("Email address").fill(managerEmail);
  await owner.getByLabel("Role").selectOption("BRANCH_MANAGER");
  await owner.getByLabel("Powai").check();
  await owner.getByRole("button", { name: "Create invitation" }).click();
  const inviteUrl = await owner.getByLabel("Invitation link").inputValue();
  const managerCtx = await browser.newContext();
  const manager = await managerCtx.newPage();
  await assignDistinctClientIp(manager);
  await manager.goto(inviteUrl);
  await manager.getByRole("link", { name: "Create account and join" }).click();
  await manager.getByLabel("Full name").fill("Sana Manager");
  await manager.getByLabel("Password").fill("correct-horse-battery");
  await manager.getByRole("button", { name: "Create account" }).click();
  await manager.getByRole("button", { name: "Accept invitation" }).click();
  await expect(manager).toHaveURL(/\/app$/);

  // Owner creates a plan (₹2,000 incl. 18% GST).
  await owner.goto("/app/plans/new");
  await owner.getByLabel("Name").fill("Monthly");
  await owner.getByLabel("Price (INR)").fill("2000");
  await owner.getByLabel("Tax rate (%)").fill("18");
  await owner.getByRole("button", { name: "Create plan" }).click();
  await expect(owner.getByText("Plan created.")).toBeVisible();

  // The manager registers a member and sells the plan with a partial payment.
  await manager.goto("/app/members/new");
  await manager.getByLabel("First name").fill("Asha");
  await manager.getByLabel("Last name").fill("Kulkarni");
  await manager.getByRole("textbox", { name: /^Phone/ }).fill("+91 99887 76655");
  await manager.getByRole("button", { name: "Add member" }).click();
  await expect(manager.getByText("Member added.")).toBeVisible();
  await manager.getByRole("link", { name: "Sell membership" }).click();
  await manager.getByLabel("Amount (INR)").fill("500");
  await manager.getByLabel("Method").selectOption("UPI");
  await manager.getByRole("button", { name: "Sell and invoice" }).click();
  await expect(manager.getByText("Membership sold and invoice issued.")).toBeVisible();
  await expect(manager.getByText("₹1,500.00").first()).toBeVisible(); // balance due

  // Record the rest.
  await manager.getByRole("button", { name: "Record payment" }).click();
  await expect(manager.getByText("Payment recorded.")).toBeVisible();
  await manager.reload();
  await expect(manager.getByText("Paid", { exact: true }).first()).toBeVisible();

  // Front desk check-in at Powai.
  await manager.goto("/app/front-desk?q=asha");
  await manager.getByRole("button", { name: "Check in" }).click();
  await expect(manager.getByText("Asha Kulkarni checked in")).toBeVisible();
  // A second tap is recognized as a duplicate.
  await manager.getByRole("button", { name: "Check in" }).click();
  await expect(manager.getByText("Asha Kulkarni is already checked in")).toBeVisible();

  // Owner's dashboard reflects it, and the audit log tells the story.
  await owner.goto("/app");
  await expect(owner.getByRole("link", { name: /Collected today.*₹2,000\.00/ })).toBeVisible();
  await expect(owner.getByRole("link", { name: /Visits today.*1/ })).toBeVisible();
  await expect(owner.getByRole("link", { name: /Active members.*1/ })).toBeVisible();
  await owner.goto("/app/settings/audit-logs");
  for (const text of [
    "Accepted an invitation",
    "Registered a member",
    "Sold a membership",
    "Recorded a payment",
    "Checked in a member",
  ]) {
    await expect(owner.getByRole("cell", { name: text }).first()).toBeVisible();
  }
  await managerCtx.close();
});

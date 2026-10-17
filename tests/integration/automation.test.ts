import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { addDays, todayIn, toDbDate } from "@/lib/dates";
import { ConflictError, ForbiddenError } from "@/lib/errors";
import { branchInputSchema } from "@/modules/branches/schemas";
import { createBranch } from "@/modules/branches/service";
import { startTrial } from "@/modules/entitlements/service";
import { commitMemberImport, previewMemberImport } from "@/modules/imports/members";
import { createWebhookEndpoint, deliverWebhook, emitEvent } from "@/modules/integrations/webhooks";
import { createMember } from "@/modules/members/service";
import { memberInputSchema } from "@/modules/members/schemas";
import { listMyNotifications } from "@/modules/notifications/service";
import { parseInput } from "@/server/actions";
import { db } from "@/server/database/client";
import { runDailyForOrganization, scheduleDailyJobs } from "@/server/jobs/daily";
import { enqueueJob } from "@/server/jobs/queue";
import { runDueJobs } from "@/server/jobs/runner";
import { contextFor, createMemberFixture, createPlanFixture, twoTenantWorld } from "./fixtures";

describe("job runner", () => {
  it("retries with backoff, then marks jobs dead after max attempts", async () => {
    await enqueueJob(db, "always.fails", {}, { maxAttempts: 2 });
    const handlers = {
      "always.fails": async () => {
        throw new Error("boom");
      },
    };
    expect(await runDueJobs(db, handlers)).toMatchObject({ claimed: 1, retried: 1 });
    const retrying = await db.job.findFirstOrThrow();
    expect(retrying).toMatchObject({ status: "PENDING", attempts: 1, lastError: "boom" });
    expect(retrying.runAt.getTime()).toBeGreaterThan(Date.now());
    expect((await runDueJobs(db, handlers)).claimed).toBe(0); // not due yet
    await runDueJobs(db, handlers, { now: new Date(Date.now() + 3 * 60_000) });
    expect((await db.job.findFirstOrThrow()).status).toBe("DEAD");
  });

  it("never runs the same job twice when runners overlap", async () => {
    for (let i = 0; i < 20; i++) await enqueueJob(db, "count", { i });
    let runs = 0;
    const handlers = {
      count: async () => {
        runs++;
      },
    };
    const results = await Promise.all([
      runDueJobs(db, handlers),
      runDueJobs(db, handlers),
      runDueJobs(db, handlers),
    ]);
    expect(results.reduce((a, r) => a + r.claimed, 0)).toBe(20);
    expect(runs).toBe(20);
  });

  it("deduplicates jobs by idempotency key", async () => {
    const w = await twoTenantWorld();
    expect(await scheduleDailyJobs(db)).toBe(2);
    expect(await scheduleDailyJobs(db)).toBe(0);
    expect(await db.job.count({ where: { organizationId: w.orgA.id } })).toBe(1);
  });
});

describe("daily organization job", () => {
  it("ends past freezes, queues one renewal reminder per membership and notifies staff", async () => {
    const w = await twoTenantWorld();
    const today = todayIn("Asia/Kolkata");
    const plan = await createPlanFixture(w.orgA.id);
    const member = await db.member.create({
      data: {
        organizationId: w.orgA.id,
        homeBranchId: w.branches.a1.id,
        memberNumber: "M-R1",
        firstName: "Rina",
        lastName: "Shah",
        email: "rina@example.com",
      },
    });
    await db.gymMembership.create({
      data: {
        organizationId: w.orgA.id,
        memberId: member.id,
        planId: plan.id,
        branchId: w.branches.a1.id,
        startDate: toDbDate(addDays(today, -23)),
        endDate: toDbDate(addDays(today, 7)),
        planName: "Monthly",
        planKind: "TIME_BASED",
        priceMinor: 1,
        currency: "INR",
        allBranches: true,
      },
    });
    const frozenMember = await createMemberFixture(w.orgA.id, w.branches.a1.id);
    const frozen = await db.gymMembership.create({
      data: {
        organizationId: w.orgA.id,
        memberId: frozenMember.id,
        planId: plan.id,
        branchId: w.branches.a1.id,
        status: "FROZEN",
        startDate: toDbDate(addDays(today, -10)),
        endDate: toDbDate(addDays(today, 40)),
        frozenFrom: toDbDate(addDays(today, -5)),
        frozenUntil: toDbDate(addDays(today, -1)),
        planName: "Monthly",
        planKind: "TIME_BASED",
        priceMinor: 1,
        currency: "INR",
        allBranches: true,
      },
    });

    const first = await runDailyForOrganization(db, w.orgA.id, today);
    expect(first).toMatchObject({ unfrozen: 1, reminders: 1 });
    expect((await db.gymMembership.findUniqueOrThrow({ where: { id: frozen.id } })).status).toBe(
      "ACTIVE",
    );
    const again = await runDailyForOrganization(db, w.orgA.id, today);
    expect(again.reminders).toBe(0);
    expect(await db.emailDelivery.count()).toBe(1);

    const owner = await contextFor(w.users.ownerA.id);
    const { items } = await listMyNotifications(db, owner);
    expect(items.some((n) => n.type === "renewals_due")).toBe(true);
    // Org B staff get nothing.
    expect((await listMyNotifications(db, await contextFor(w.users.ownerB.id))).items).toHaveLength(
      0,
    );
  });
});

describe("outbound webhooks", () => {
  it("delivers signed payloads, records attempts and retries failures", async () => {
    const w = await twoTenantWorld();
    const owner = await contextFor(w.users.ownerA.id);
    const { secret } = await createWebhookEndpoint(db, owner, {
      url: "http://localhost:9/hook",
      events: ["member.created"],
    });
    await createMember(
      db,
      owner,
      parseInput(memberInputSchema, {
        firstName: "Web",
        lastName: "Hook",
        homeBranchId: w.branches.a1.id,
      }),
    );
    const delivery = await db.webhookDelivery.findFirstOrThrow();
    expect(delivery.eventType).toBe("member.created");

    const failing = (async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
    await expect(deliverWebhook(db, delivery.id, failing)).rejects.toThrow(/500/);
    expect(
      await db.webhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } }),
    ).toMatchObject({ status: "FAILED", attempts: 1, responseStatus: 500 });

    let captured: { body: string; signature: string } | null = null;
    const ok = (async (_url: string, init: RequestInit) => {
      captured = {
        body: String(init.body),
        signature: (init.headers as Record<string, string>)["fitgrid-signature"]!,
      };
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;
    await deliverWebhook(db, delivery.id, ok);
    expect(
      await db.webhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } }),
    ).toMatchObject({ status: "SENT", attempts: 2 });
    const { body, signature } = captured!;
    const [, t, v1] = /^t=(\d+),v1=([0-9a-f]+)$/.exec(signature)!;
    expect(createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")).toBe(v1);
    expect(JSON.parse(body)).toMatchObject({ type: "member.created", organizationId: w.orgA.id });
  });

  it("only notifies the organization's own endpoints, and requires permission", async () => {
    const w = await twoTenantWorld();
    await createWebhookEndpoint(db, await contextFor(w.users.ownerB.id), {
      url: "https://example.com/b",
      events: ["member.created"],
    });
    await emitEvent(db, w.orgA.id, "member.created", { memberId: "x" });
    expect(await db.webhookDelivery.count()).toBe(0);
    await expect(
      createWebhookEndpoint(db, await contextFor(w.users.managerA1.id), {
        url: "https://example.com",
        events: ["member.created"],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("plan limits", () => {
  it("enforces the plan's branch and member limits", async () => {
    const w = await twoTenantWorld();
    await startTrial(db, w.orgA.id, "starter"); // Starter: 1 branch, 300 members
    const owner = await contextFor(w.users.ownerA.id);
    await expect(
      createBranch(
        db,
        owner,
        parseInput(branchInputSchema, {
          name: "Third",
          timezone: "Asia/Kolkata",
          countryCode: "IN",
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictError);
    await db.platformPlan.update({ where: { code: "starter" }, data: { maxMembers: 1 } });
    try {
      await createMember(
        db,
        owner,
        parseInput(memberInputSchema, {
          firstName: "A",
          lastName: "One",
          homeBranchId: w.branches.a1.id,
        }),
      );
      await expect(
        createMember(
          db,
          owner,
          parseInput(memberInputSchema, {
            firstName: "B",
            lastName: "Two",
            homeBranchId: w.branches.a1.id,
          }),
        ),
      ).rejects.toThrow(/allows 1 active members/);
    } finally {
      await db.platformPlan.update({ where: { code: "starter" }, data: { maxMembers: 300 } });
    }
  });
});

describe("member CSV import", () => {
  const csv = [
    "First Name,Last Name,Email,Phone,Home Branch Code,Tags",
    "Asha,Rao,asha@example.com,+919800000001,A1,morning;student",
    "Bad,,x@example.com,,A1,",
    "Asha,Duplicate,asha@example.com,,A2,",
    "Ghost,Branch,g@example.com,,B1,",
    "Dev,Patel,,+919800000002,,",
  ].join("\n");

  it("previews without writing, then imports only valid new rows atomically", async () => {
    const w = await twoTenantWorld();
    const owner = await contextFor(w.users.ownerA.id);
    const preview = await previewMemberImport(db, owner, csv, w.branches.a1.id);
    expect(preview.counts).toEqual({ ready: 2, duplicate: 1, invalid: 2 });
    expect(await db.member.count()).toBe(0);
    const run = await commitMemberImport(db, owner, csv, w.branches.a1.id, "members.csv");
    expect(run).toMatchObject({ createdRows: 2, skippedRows: 3, status: "COMPLETED" });
    expect(
      (await db.member.findFirstOrThrow({ where: { email: "asha@example.com" } })).tags,
    ).toEqual(["morning", "student"]);
    // Re-importing finds them as duplicates.
    await expect(commitMemberImport(db, owner, csv, w.branches.a1.id)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("requires the import permission", async () => {
    const w = await twoTenantWorld();
    await expect(
      previewMemberImport(db, await contextFor(w.users.receptionistA1.id), csv, w.branches.a1.id),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

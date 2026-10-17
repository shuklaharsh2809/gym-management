/**
 * Demo seed data. Everything created here is fictional and flagged with is_demo = true.
 * Idempotent: demo organizations that already exist are left untouched.
 * Do not run against production.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import type { BranchAccessScope, OrganizationRole } from "../src/generated/prisma/enums";
import { seedFacilities, seedOperations, seedTeamAndSchedule } from "./seed-operations";

export const DEMO_PASSWORD = "FitGrid-demo-2026";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

interface DemoUser {
  key: string;
  name: string;
  email: string;
}

const users: DemoUser[] = [
  { key: "priya", name: "Priya Sharma", email: "owner.northside@example.com" },
  { key: "arjun", name: "Arjun Mehta", email: "manager.andheri@example.com" },
  { key: "meera", name: "Meera Iyer", email: "frontdesk.bandra@example.com" },
  { key: "ravi", name: "Ravi Kapoor", email: "accounts.northside@example.com" },
  { key: "james", name: "James Whitfield", email: "owner.harbour@example.com" },
  { key: "sam", name: "Sam Okafor", email: "trainer.shoreditch@example.com" },
  { key: "alex", name: "Alex Fernandes", email: "alex.consultant@example.com" },
];

interface DemoOrg {
  slug: string;
  name: string;
  legalName: string;
  countryCode: string;
  timezone: string;
  currency: string;
  locale: string;
  branches: { code: string; name: string; city: string; region: string }[];
  members: {
    user: string;
    role: OrganizationRole;
    scope: BranchAccessScope;
    branches?: string[];
  }[];
}

const organizations: DemoOrg[] = [
  {
    slug: "demo-northside-fitness",
    name: "Northside Fitness (Demo)",
    legalName: "Northside Fitness Private Limited (fictional)",
    countryCode: "IN",
    timezone: "Asia/Kolkata",
    currency: "INR",
    locale: "en-IN",
    branches: [
      { code: "AND-01", name: "Andheri West", city: "Mumbai", region: "Maharashtra" },
      { code: "BAN-01", name: "Bandra", city: "Mumbai", region: "Maharashtra" },
      { code: "KOR-01", name: "Koramangala", city: "Bengaluru", region: "Karnataka" },
    ],
    members: [
      { user: "priya", role: "OWNER", scope: "ALL_BRANCHES" },
      { user: "arjun", role: "BRANCH_MANAGER", scope: "ASSIGNED_BRANCHES", branches: ["AND-01"] },
      { user: "meera", role: "RECEPTIONIST", scope: "ASSIGNED_BRANCHES", branches: ["BAN-01"] },
      { user: "ravi", role: "ACCOUNTANT", scope: "ALL_BRANCHES" },
      { user: "alex", role: "TRAINER", scope: "ASSIGNED_BRANCHES", branches: ["BAN-01"] },
    ],
  },
  {
    slug: "demo-harbour-strength",
    name: "Harbour Strength Studio (Demo)",
    legalName: "Harbour Strength Ltd (fictional)",
    countryCode: "GB",
    timezone: "Europe/London",
    currency: "GBP",
    locale: "en-GB",
    branches: [
      { code: "CAN-01", name: "Canary Wharf", city: "London", region: "Greater London" },
      { code: "SHO-01", name: "Shoreditch", city: "London", region: "Greater London" },
    ],
    members: [
      { user: "james", role: "OWNER", scope: "ALL_BRANCHES" },
      { user: "alex", role: "ADMIN", scope: "ALL_BRANCHES" },
      { user: "sam", role: "TRAINER", scope: "ASSIGNED_BRANCHES", branches: ["SHO-01"] },
    ],
  },
];

async function upsertUser(user: DemoUser, passwordHash: string) {
  const existing = await db.user.findUnique({ where: { email: user.email } });
  if (existing) return existing;
  // Mirror Better Auth's sign-up: the credential account's accountId is the user ID.
  return db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { name: user.name, email: user.email, emailVerified: true },
    });
    await tx.account.create({
      data: {
        userId: created.id,
        providerId: "credential",
        accountId: created.id,
        password: passwordHash,
      },
    });
    return created;
  });
}

async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Refusing to seed demo data in production");

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const userIds = new Map<string, string>();
  for (const u of users) userIds.set(u.key, (await upsertUser(u, passwordHash)).id);

  for (const org of organizations) {
    if (await db.organization.findUnique({ where: { slug: org.slug } })) {
      console.log(`- ${org.name}: already present, skipped`);
      continue;
    }
    await db.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          slug: org.slug,
          name: org.name,
          legalName: org.legalName,
          countryCode: org.countryCode,
          timezone: org.timezone,
          currency: org.currency,
          locale: org.locale,
          isDemo: true,
        },
      });
      const branchIds = new Map<string, string>();
      for (const b of org.branches) {
        const branch = await tx.branch.create({
          data: {
            ...b,
            organizationId: created.id,
            countryCode: org.countryCode,
            timezone: org.timezone,
          },
        });
        branchIds.set(b.code, branch.id);
      }
      for (const m of org.members) {
        const membership = await tx.organizationMembership.create({
          data: {
            organizationId: created.id,
            userId: userIds.get(m.user)!,
            role: m.role,
            branchScope: m.scope,
          },
        });
        for (const code of m.branches ?? []) {
          await tx.branchAssignment.create({
            data: {
              organizationId: created.id,
              membershipId: membership.id,
              branchId: branchIds.get(code)!,
            },
          });
        }
      }
      await tx.auditLog.create({
        data: {
          organizationId: created.id,
          actorUserId: userIds.get(org.members[0]!.user)!,
          action: "organization.created",
          entityType: "organization",
          entityId: created.id,
          metadata: { source: "demo-seed" },
        },
      });
    });
    console.log(`+ ${org.name}: created with ${org.branches.length} branches`);
  }

  for (const org of organizations) {
    const record = await db.organization.findUniqueOrThrow({ where: { slug: org.slug } });
    const owner = userIds.get(org.members[0]!.user)!;
    if (await seedOperations(db, record.id, owner))
      console.log(`+ ${org.name}: plans, members, invoices and visits`);
    if (await seedTeamAndSchedule(db, record.id, owner))
      console.log(`+ ${org.name}: staff, classes, bookings, shifts and leads`);
    if (await seedFacilities(db, record.id, owner))
      console.log(`+ ${org.name}: suppliers, equipment, inventory and expenses`);
  }

  console.log(`\nDemo accounts (password for all: ${DEMO_PASSWORD}):`);
  for (const u of users) console.log(`  ${u.email.padEnd(34)} ${u.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

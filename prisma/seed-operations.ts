/**
 * Fictional operational demo data for a demo organization: plans, members, memberships,
 * invoices, payments and 30 days of check-ins. Deterministic (seeded PRNG) so every run of
 * a fresh database produces the same data. Writes respect all database invariants.
 */
import type { PrismaClient } from "../src/generated/prisma/client";
import { addDays, dayBounds, todayIn, toDbDate } from "../src/lib/dates";
import { computeLine, sumLines } from "../src/lib/money";
import { computeEndDate } from "../src/modules/memberships/lifecycle";

function prng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const FIRST = [
  "Aarav",
  "Diya",
  "Kabir",
  "Meera",
  "Rohan",
  "Ananya",
  "Vihaan",
  "Ishita",
  "Arjun",
  "Saanvi",
  "Nikhil",
  "Tara",
  "Kunal",
  "Priya",
  "Dev",
  "Zoya",
  "Omar",
  "Lena",
  "Sam",
  "Chloe",
  "Ethan",
  "Grace",
  "Leo",
  "Maya",
];
const LAST = [
  "Sharma",
  "Iyer",
  "Khan",
  "Patel",
  "Reddy",
  "Mehta",
  "Gupta",
  "Nair",
  "Fernandes",
  "Bose",
  "Shah",
  "Rao",
  "Brown",
  "Clarke",
  "Hughes",
  "Walker",
  "Evans",
  "Wright",
];

interface PlanSpec {
  name: string;
  kind: "TIME_BASED" | "DAY_PASS" | "CLASS_PACK";
  unit: "DAY" | "MONTH" | "YEAR";
  count: number;
  price: number;
  joining: number;
  freeze: number;
  grace: number;
  sessions?: number;
}

const PLANS_BY_CURRENCY: Record<string, PlanSpec[]> = {
  INR: [
    {
      name: "Monthly",
      kind: "TIME_BASED",
      unit: "MONTH",
      count: 1,
      price: 250000,
      joining: 50000,
      freeze: 7,
      grace: 3,
    },
    {
      name: "Quarterly",
      kind: "TIME_BASED",
      unit: "MONTH",
      count: 3,
      price: 650000,
      joining: 50000,
      freeze: 15,
      grace: 5,
    },
    {
      name: "Annual",
      kind: "TIME_BASED",
      unit: "YEAR",
      count: 1,
      price: 2200000,
      joining: 0,
      freeze: 30,
      grace: 7,
    },
    {
      name: "Day pass",
      kind: "DAY_PASS",
      unit: "DAY",
      count: 1,
      price: 30000,
      joining: 0,
      freeze: 0,
      grace: 0,
    },
    {
      name: "10-class pack",
      kind: "CLASS_PACK",
      unit: "MONTH",
      count: 2,
      price: 400000,
      joining: 0,
      freeze: 0,
      grace: 0,
      sessions: 10,
    },
  ],
  GBP: [
    {
      name: "Monthly",
      kind: "TIME_BASED",
      unit: "MONTH",
      count: 1,
      price: 4900,
      joining: 2500,
      freeze: 7,
      grace: 3,
    },
    {
      name: "Annual",
      kind: "TIME_BASED",
      unit: "YEAR",
      count: 1,
      price: 49000,
      joining: 0,
      freeze: 30,
      grace: 7,
    },
    {
      name: "Day pass",
      kind: "DAY_PASS",
      unit: "DAY",
      count: 1,
      price: 1200,
      joining: 0,
      freeze: 0,
      grace: 0,
    },
  ],
};

export async function seedOperations(
  db: PrismaClient,
  organizationId: string,
  actorUserId: string,
) {
  if ((await db.membershipPlan.count({ where: { organizationId } })) > 0) return false;
  const org = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    include: { branches: { where: { status: "ACTIVE" }, orderBy: { code: "asc" } } },
  });
  const rand = prng(org.slug.length * 7919);
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
  const taxBps = org.currency === "INR" ? 1800 : 2000;
  const today = todayIn(org.timezone);
  const specs = PLANS_BY_CURRENCY[org.currency] ?? PLANS_BY_CURRENCY.INR!;

  let invoiceNo = 0;
  let receiptNo = 0;
  let memberNo = 0;

  await db.$transaction(
    async (tx) => {
      const plans = [];
      for (const p of specs) {
        plans.push(
          await tx.membershipPlan.create({
            data: {
              organizationId,
              name: p.name,
              kind: p.kind,
              durationUnit: p.unit,
              durationCount: p.count,
              sessionCount: p.sessions ?? null,
              priceMinor: p.price,
              joiningFeeMinor: p.joining,
              currency: org.currency,
              taxRateBps: taxBps,
              taxInclusive: true,
              gracePeriodDays: p.grace,
              maxFreezeDays: p.freeze,
            },
          }),
        );
      }

      const memberCount = org.branches.length * 12;
      for (let i = 0; i < memberCount; i++) {
        const branch = org.branches[i % org.branches.length]!;
        const first = pick(FIRST);
        const last = pick(LAST);
        memberNo++;
        const member = await tx.member.create({
          data: {
            organizationId,
            homeBranchId: branch.id,
            memberNumber: `M-${String(memberNo).padStart(5, "0")}`,
            firstName: first,
            lastName: last,
            email: `${first}.${last}.${memberNo}@example.com`.toLowerCase(),
            phone: `${org.currency === "INR" ? "+9198" : "+4477"}${String(10000000 + memberNo * 7919).slice(0, 8)}`,
            tags: rand() < 0.3 ? ["morning"] : rand() < 0.2 ? ["student"] : [],
            createdById: actorUserId,
            createdAt: new Date(Date.now() - Math.floor(rand() * 120) * 86_400_000),
          },
        });

        // Scenario mix: most current, some expiring soon, some expired, a few frozen, some none.
        const r = rand();
        if (r < 0.1) continue; // prospect without membership
        const plan =
          r < 0.15
            ? plans.find((p) => p.kind === "DAY_PASS")!
            : pick(plans.filter((p) => p.kind === "TIME_BASED"));
        let start: string;
        if (r < 0.25)
          start = addDays(today, -Math.floor(rand() * 20) - 40); // likely expired monthly
        else if (r < 0.4)
          start = addDays(today, -Math.floor(rand() * 5) - 24); // monthly expiring soon
        else start = addDays(today, -Math.floor(rand() * 25));
        if (plan.kind === "DAY_PASS") start = addDays(today, -Math.floor(rand() * 10));
        const end = computeEndDate(start, plan.durationUnit, plan.durationCount);
        const frozen = r > 0.95 && plan.maxFreezeDays > 0;

        const membership = await tx.gymMembership.create({
          data: {
            organizationId,
            memberId: member.id,
            planId: plan.id,
            branchId: branch.id,
            status: frozen ? "FROZEN" : "ACTIVE",
            startDate: toDbDate(start),
            endDate: toDbDate(frozen ? addDays(end, 5) : end),
            frozenFrom: frozen ? toDbDate(addDays(today, -2)) : null,
            frozenUntil: frozen ? toDbDate(addDays(today, 2)) : null,
            freezeDaysUsed: frozen ? 5 : 0,
            maxFreezeDays: plan.maxFreezeDays,
            planName: plan.name,
            planKind: plan.kind,
            priceMinor: plan.priceMinor,
            currency: org.currency,
            gracePeriodDays: plan.gracePeriodDays,
            allBranches: true,
            createdById: actorUserId,
          },
        });
        await tx.membershipChange.create({
          data: {
            organizationId,
            membershipId: membership.id,
            type: "CREATED",
            toEndDate: toDbDate(end),
            actorId: actorUserId,
          },
        });

        const lines = [
          {
            description: `${plan.name} (${start} to ${end})`,
            unitPriceMinor: plan.priceMinor,
            membershipId: membership.id,
          },
          ...(plan.joiningFeeMinor > 0
            ? [
                {
                  description: "Joining fee",
                  unitPriceMinor: plan.joiningFeeMinor,
                  membershipId: null,
                },
              ]
            : []),
        ].map((l) => ({
          ...l,
          ...computeLine({
            unitPriceMinor: l.unitPriceMinor,
            quantity: 1,
            taxRateBps: taxBps,
            taxInclusive: true,
          }),
        }));
        const totals = sumLines(lines);
        // 85% paid in full, 10% part-paid, 5% unpaid.
        const pr = rand();
        const paid =
          pr < 0.85 ? totals.totalMinor : pr < 0.95 ? Math.floor(totals.totalMinor / 2) : 0;
        const issuedAt = new Date(dayBounds(start, org.timezone).start.getTime() + 10 * 3600_000);
        invoiceNo++;
        const invoice = await tx.invoice.create({
          data: {
            organizationId,
            branchId: branch.id,
            memberId: member.id,
            number: `INV-${String(invoiceNo).padStart(6, "0")}`,
            source: "MEMBERSHIP",
            status: paid === totals.totalMinor ? "PAID" : "OPEN",
            currency: org.currency,
            subtotalMinor: totals.netMinor,
            taxMinor: totals.taxMinor,
            totalMinor: totals.totalMinor,
            amountPaidMinor: paid,
            issuedAt,
            createdById: actorUserId,
          },
        });
        await tx.invoiceLine.createMany({
          data: lines.map((l, idx) => ({
            organizationId,
            invoiceId: invoice.id,
            sortOrder: idx,
            description: l.description,
            quantity: 1,
            unitPriceMinor: l.unitPriceMinor,
            taxRateBps: taxBps,
            taxInclusive: true,
            netMinor: l.netMinor,
            taxMinor: l.taxMinor,
            totalMinor: l.totalMinor,
            membershipId: l.membershipId,
          })),
        });
        if (paid > 0) {
          receiptNo++;
          await tx.payment.create({
            data: {
              organizationId,
              branchId: branch.id,
              invoiceId: invoice.id,
              memberId: member.id,
              receiptNumber: `RCP-${String(receiptNo).padStart(6, "0")}`,
              amountMinor: paid,
              currency: org.currency,
              method: pick(
                org.currency === "INR"
                  ? (["UPI", "UPI", "CASH", "CARD"] as const)
                  : (["CARD", "CARD", "CASH"] as const),
              ),
              receivedAt: issuedAt,
              receivedById: actorUserId,
            },
          });
        }

        // Visits on days the membership was valid during the last 30 days.
        if (plan.kind === "TIME_BASED" && !frozen) {
          for (let d = 30; d >= 0; d--) {
            const day = addDays(today, -d);
            if (day < start || day > end || rand() > 0.45) continue;
            const { start: dayStart } = dayBounds(day, org.timezone);
            const hour = pick([6, 7, 7, 8, 9, 12, 17, 18, 18, 19, 20]);
            const checkedInAt = new Date(
              dayStart.getTime() + (hour * 60 + Math.floor(rand() * 50)) * 60_000,
            );
            if (checkedInAt > new Date()) continue;
            await tx.checkIn.create({
              data: {
                organizationId,
                branchId: branch.id,
                memberId: member.id,
                membershipId: membership.id,
                status: "ALLOWED",
                checkedInAt,
                checkedOutAt: d > 0 ? new Date(checkedInAt.getTime() + 75 * 60_000) : null,
                recordedById: actorUserId,
              },
            });
          }
        }
      }

      for (const [key, value] of [
        ["member", memberNo],
        ["invoice", invoiceNo],
        ["receipt", receiptNo],
      ] as const) {
        await tx.organizationSequence.create({
          data: { organizationId, key, nextValue: value + 1 },
        });
      }
    },
    { timeout: 120_000 },
  );
  return true;
}

/** Staff, trainers, classes with bookings, shifts and leads. Runs once per demo organization. */
export async function seedTeamAndSchedule(
  db: PrismaClient,
  organizationId: string,
  actorUserId: string,
) {
  if ((await db.classType.count({ where: { organizationId } })) > 0) return false;
  const org = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    include: { branches: { where: { status: "ACTIVE" }, orderBy: { code: "asc" } } },
  });
  const rand = prng(org.slug.length * 104729);
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
  const today = todayIn(org.timezone);
  const memberIds = await db.member.findMany({
    where: { organizationId },
    select: { id: true, homeBranchId: true },
  });
  const accessMembers = new Set(
    (
      await db.gymMembership.findMany({
        where: {
          organizationId,
          planKind: "TIME_BASED",
          status: "ACTIVE",
          startDate: { lte: toDbDate(today) },
          endDate: { gte: toDbDate(addDays(today, 7)) },
        },
        select: { memberId: true },
      })
    ).map((m) => m.memberId),
  );

  await db.$transaction(
    async (tx) => {
      const coaches = [
        { firstName: "Kiran", lastName: "Desai", specializations: ["strength", "HIIT"] },
        { firstName: "Leela", lastName: "Menon", specializations: ["yoga", "mobility"] },
        { firstName: "Marcus", lastName: "Bell", specializations: ["boxing", "conditioning"] },
      ];
      const trainers = [];
      for (const [i, c] of coaches.entries()) {
        const branch = org.branches[i % org.branches.length]!;
        trainers.push(
          await tx.employee.create({
            data: {
              organizationId,
              primaryBranchId: branch.id,
              ...c,
              jobTitle: "Coach",
              employmentType: i === 2 ? "CONTRACTOR" : "FULL_TIME",
              startDate: toDbDate(addDays(today, -400 + i * 90)),
              isTrainer: true,
              currency: org.currency,
              monthlySalaryMinor:
                org.currency === "INR" ? 4_500_000 + i * 500_000 : 260_000 + i * 20_000,
              commissionBps: 1000,
            },
          }),
        );
      }
      const frontDesk = await tx.employee.create({
        data: {
          organizationId,
          primaryBranchId: org.branches[0]!.id,
          firstName: "Pooja",
          lastName: "Rao",
          jobTitle: "Front desk",
          employmentType: "PART_TIME",
          startDate: toDbDate(addDays(today, -200)),
          currency: org.currency,
          monthlySalaryMinor: org.currency === "INR" ? 2_200_000 : 150_000,
        },
      });

      const types = [];
      for (const t of [
        { name: "HIIT", durationMinutes: 45, defaultCapacity: 16, color: "#b91c1c" },
        { name: "Yoga", durationMinutes: 60, defaultCapacity: 20, color: "#047857" },
        { name: "Spin", durationMinutes: 45, defaultCapacity: 14, color: "#1d4ed8" },
      ]) {
        types.push(await tx.classType.create({ data: { organizationId, ...t } }));
      }
      for (const branch of org.branches) {
        const room = await tx.room.create({
          data: { organizationId, branchId: branch.id, name: "Studio", capacity: 20 },
        });
        for (let d = 0; d < 7; d++) {
          const day = addDays(today, d);
          for (const [slot, time] of ["07:00", "18:30"].entries()) {
            const type = types[(d + slot) % types.length]!;
            const trainer = trainers[(d + slot) % trainers.length]!;
            const startsAt = dayBounds(day, org.timezone).start;
            const [h, m] = time.split(":").map(Number) as [number, number];
            const start = new Date(startsAt.getTime() + (h * 60 + m) * 60_000);
            if (start < new Date()) continue;
            const session = await tx.classSession.create({
              data: {
                organizationId,
                branchId: branch.id,
                classTypeId: type.id,
                roomId: room.id,
                trainerId: trainer.id,
                startsAt: start,
                endsAt: new Date(start.getTime() + type.durationMinutes * 60_000),
                capacity: type.defaultCapacity,
                createdById: actorUserId,
              },
            });
            const eligible = memberIds.filter(
              (x) => x.homeBranchId === branch.id && accessMembers.has(x.id),
            );
            const count = Math.min(
              eligible.length,
              Math.floor(rand() * type.defaultCapacity * 0.9),
            );
            for (const member of eligible.slice(0, count)) {
              await tx.booking.create({
                data: {
                  organizationId,
                  sessionId: session.id,
                  memberId: member.id,
                  status: "BOOKED",
                  createdById: actorUserId,
                },
              });
            }
          }
        }
        // A week of shifts for the branch.
        for (let d = 0; d < 7; d++) {
          const day = addDays(today, d);
          const base = dayBounds(day, org.timezone).start.getTime();
          const staff = [frontDesk, ...trainers].filter((_, i) => (i + d) % 2 === 0).slice(0, 2);
          for (const [i, e] of staff.entries()) {
            if (e.primaryBranchId !== branch.id && i > 0) continue;
            const startHour = i === 0 ? 6 : 14;
            const exists = await tx.shift.findFirst({
              where: {
                employeeId: e.id,
                startsAt: { lt: new Date(base + (startHour + 8) * 3600_000) },
                endsAt: { gt: new Date(base + startHour * 3600_000) },
              },
            });
            if (exists) continue;
            await tx.shift.create({
              data: {
                organizationId,
                employeeId: e.id,
                branchId: branch.id,
                startsAt: new Date(base + startHour * 3600_000),
                endsAt: new Date(base + (startHour + 8) * 3600_000),
                createdById: actorUserId,
              },
            });
          }
        }
      }

      const owners = await tx.organizationMembership.findMany({
        where: { organizationId, status: "ACTIVE" },
        select: { id: true },
      });
      const stages = [
        "NEW",
        "NEW",
        "CONTACTED",
        "CONTACTED",
        "TRIAL_BOOKED",
        "TRIAL_COMPLETED",
        "NEGOTIATION",
        "LOST",
        "WON",
      ] as const;
      const sources = ["WALK_IN", "WEBSITE", "REFERRAL", "PHONE", "SOCIAL"] as const;
      for (let i = 0; i < 18; i++) {
        const stage = stages[i % stages.length]!;
        const created = new Date(Date.now() - Math.floor(rand() * 25) * 86_400_000);
        const lead = await tx.lead.create({
          data: {
            organizationId,
            branchId: pick(org.branches).id,
            name: `${pick(FIRST)} ${pick(LAST)}`,
            phone: `${org.currency === "INR" ? "+9197" : "+4478"}${String(20000000 + i * 104729).slice(0, 8)}`,
            source: pick([...sources]),
            stage: stage === "WON" ? "NEGOTIATION" : stage,
            lostReason:
              stage === "LOST" ? pick(["Too expensive", "Chose another gym", "Moved away"]) : null,
            interest: pick(["weight loss", "strength", "yoga", "annual plan", null]),
            ownerMembershipId: pick(owners).id,
            nextFollowUpAt:
              stage === "LOST"
                ? null
                : new Date(Date.now() + (Math.floor(rand() * 72) - 24) * 3600_000),
            createdAt: created,
            createdById: actorUserId,
          },
        });
        await tx.leadActivity.create({
          data: {
            organizationId,
            leadId: lead.id,
            type: "NOTE",
            body: "Enquiry logged (demo data).",
            createdAt: created,
            actorId: actorUserId,
          },
        });
        if (lead.nextFollowUpAt) {
          await tx.followUp.create({
            data: {
              organizationId,
              leadId: lead.id,
              dueAt: lead.nextFollowUpAt,
              note: "Call back",
              assignedToMembershipId: lead.ownerMembershipId,
              createdById: actorUserId,
            },
          });
        }
      }
    },
    { timeout: 120_000 },
  );
  return true;
}

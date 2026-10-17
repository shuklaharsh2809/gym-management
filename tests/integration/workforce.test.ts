import { describe, expect, it } from "vitest";
import { addDays, todayIn } from "@/lib/dates";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { employeeInputSchema } from "@/modules/workforce/schemas";
import {
  createEmployee,
  createShift,
  decideLeave,
  getEmployee,
  requestLeave,
  updateEmployee,
} from "@/modules/workforce/service";
import { parseInput } from "@/server/actions";
import { db } from "@/server/database/client";
import { contextFor, createEmployeeFixture, twoTenantWorld } from "./fixtures";

const tomorrow = () => addDays(todayIn("Asia/Kolkata"), 1);

describe("staff records", () => {
  it("hides and protects compensation from roles without access", async () => {
    const { users, branches } = await twoTenantWorld();
    const owner = await contextFor(users.ownerA.id);
    const input = parseInput(employeeInputSchema, {
      firstName: "Anil",
      lastName: "Kumar",
      jobTitle: "Head coach",
      employmentType: "FULL_TIME",
      primaryBranchId: branches.a1.id,
      startDate: "2026-01-01",
      monthlySalaryMinor: "4500000",
      isTrainer: "on",
    });
    const { id } = await createEmployee(db, owner, input);
    const manager = await contextFor(users.managerA1.id);
    expect((await getEmployee(db, manager, id)).monthlySalaryMinor).toBeNull();
    await updateEmployee(db, manager, id, {
      ...input,
      jobTitle: "Senior coach",
      monthlySalaryMinor: 0,
    });
    const stored = await db.employee.findUniqueOrThrow({ where: { id } });
    expect(stored.monthlySalaryMinor).toBe(4500000);
    expect(stored.jobTitle).toBe("Senior coach");
    expect((await getEmployee(db, owner, id)).monthlySalaryMinor).toBe(4500000);
  });

  it("can't read another organization's staff", async () => {
    const { orgB, users, branches } = await twoTenantWorld();
    const foreign = await createEmployeeFixture(orgB.id, branches.b1.id);
    await expect(
      getEmployee(db, await contextFor(users.ownerA.id), foreign.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("shifts and leave", () => {
  it("rejects overlapping shifts and shifts during approved leave", async () => {
    const { orgA, users, branches } = await twoTenantWorld();
    const owner = await contextFor(users.ownerA.id);
    const e = await createEmployeeFixture(orgA.id, branches.a1.id);
    const day = tomorrow();
    await createShift(db, owner, {
      employeeId: e.id,
      branchId: branches.a1.id,
      date: day,
      startTime: "06:00",
      endTime: "14:00",
    });
    await expect(
      createShift(db, owner, {
        employeeId: e.id,
        branchId: branches.a2.id,
        date: day,
        startTime: "13:00",
        endTime: "18:00",
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    const leave = await requestLeave(db, owner, {
      employeeId: e.id,
      type: "ANNUAL",
      startDate: addDays(day, 2),
      endDate: addDays(day, 3),
    });
    await decideLeave(db, owner, leave.id, { decision: "APPROVED" });
    await expect(
      createShift(db, owner, {
        employeeId: e.id,
        branchId: branches.a1.id,
        date: addDays(day, 2),
        startTime: "06:00",
        endTime: "10:00",
      }),
    ).rejects.toThrow(/approved leave/);
  });

  it("lets staff request their own leave but not approve it", async () => {
    const { orgA, users, branches, managerMembership } = await twoTenantWorld();
    const self = await createEmployeeFixture(orgA.id, branches.a1.id, {
      membershipId: managerMembership.id,
    });
    const other = await createEmployeeFixture(orgA.id, branches.a1.id);
    const manager = await contextFor(users.managerA1.id);
    const own = await requestLeave(db, manager, {
      employeeId: self.id,
      type: "SICK",
      startDate: tomorrow(),
      endDate: tomorrow(),
    });
    await expect(decideLeave(db, manager, own.id, { decision: "APPROVED" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    const receptionist = await contextFor(users.receptionistA1.id);
    await expect(
      requestLeave(db, receptionist, {
        employeeId: other.id,
        type: "SICK",
        startDate: tomorrow(),
        endDate: tomorrow(),
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

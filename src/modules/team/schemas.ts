import { z } from "zod";
import { uuidSchema } from "@/lib/validation";

/** Roles that can be granted through invitations or role changes. Ownership is never granted here. */
export const ASSIGNABLE_ROLES = [
  "ADMIN",
  "BRANCH_MANAGER",
  "RECEPTIONIST",
  "TRAINER",
  "ACCOUNTANT",
  "EQUIPMENT_TECHNICIAN",
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const accessFields = {
  role: z.enum(ASSIGNABLE_ROLES, { error: "Choose a role" }),
  branchScope: z.enum(["ALL_BRANCHES", "ASSIGNED_BRANCHES"], { error: "Choose branch access" }),
  branchIds: z.array(uuidSchema).max(200).default([]),
};

interface AccessShape {
  role: AssignableRole;
  branchScope: "ALL_BRANCHES" | "ASSIGNED_BRANCHES";
  branchIds: string[];
}

function normalizeAccess<T extends AccessShape>(v: T): T {
  return { ...v, branchIds: v.branchScope === "ALL_BRANCHES" ? [] : [...new Set(v.branchIds)] };
}

function checkAccess(v: AccessShape, ctx: z.RefinementCtx) {
  if (v.role === "ADMIN" && v.branchScope !== "ALL_BRANCHES") {
    ctx.addIssue({
      code: "custom",
      path: ["branchScope"],
      message: "Administrators always have access to all branches",
    });
  }
  if (v.branchScope === "ASSIGNED_BRANCHES" && v.branchIds.length === 0) {
    ctx.addIssue({ code: "custom", path: ["branchIds"], message: "Choose at least one branch" });
  }
}

/** Role + branch access, used when editing a membership. */
export const accessSchema = z
  .object(accessFields)
  .transform(normalizeAccess)
  .superRefine(checkAccess);

export const invitationInputSchema = z
  .object({
    email: z
      .string({ error: "Email is required" })
      .trim()
      .toLowerCase()
      .pipe(z.email("Enter a valid email address").max(200)),
    ...accessFields,
  })
  .transform(normalizeAccess)
  .superRefine(checkAccess);

export type AccessInput = z.output<typeof accessSchema>;
export type InvitationInput = z.output<typeof invitationInputSchema>;

/** Form helper: branch checkboxes arrive as repeated `branchIds` fields. */
export function accessFormToObject(formData: FormData) {
  return {
    email: formData.get("email") ?? undefined,
    role: formData.get("role") ?? undefined,
    branchScope: formData.get("branchScope") ?? undefined,
    branchIds: formData.getAll("branchIds").filter((v) => typeof v === "string"),
  };
}

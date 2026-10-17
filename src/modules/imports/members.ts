import { parseCsvObjects } from "@/lib/csv";
import { ConflictError, ValidationError } from "@/lib/errors";
import { recordAudit } from "@/modules/audit/audit";
import { assertWithinLimit } from "@/modules/entitlements/service";
import { memberInputSchema, normalizePhone, type MemberInput } from "@/modules/members/schemas";
import { createMemberInTx } from "@/modules/members/service";
import type { Database, DbClient } from "@/server/database/client";
import type { OrganizationContext } from "@/server/authorization/context";
import { canAccessBranch, requirePermission } from "@/server/authorization/guards";

export const MEMBER_IMPORT_COLUMNS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "date_of_birth",
  "home_branch_code",
  "tags",
] as const;
export const MAX_IMPORT_ROWS = 2000;

export type ImportRowStatus = "ready" | "duplicate" | "invalid";

export interface ImportPreviewRow {
  line: number;
  name: string;
  status: ImportRowStatus;
  messages: string[];
  input?: MemberInput;
}

/**
 * Validate a members CSV without writing anything. Rows are checked against the same schema as
 * the member form; duplicates (by phone or email) are detected against existing members and
 * earlier rows in the same file.
 */
export async function previewMemberImport(
  db: DbClient,
  ctx: OrganizationContext,
  csv: string,
  defaultBranchId: string,
) {
  requirePermission(ctx, "members.import");
  const { headers, rows } = parseCsvObjects(csv);
  for (const required of ["first_name", "last_name"]) {
    if (!headers.includes(required))
      throw new ValidationError(`The file needs a "${required}" column.`);
  }
  if (rows.length === 0) throw new ValidationError("The file has no rows.");
  if (rows.length > MAX_IMPORT_ROWS)
    throw new ValidationError(`Import at most ${MAX_IMPORT_ROWS} rows at a time.`);

  const branches = await db.branch.findMany({
    where: { organizationId: ctx.organizationId, status: "ACTIVE" },
    select: { id: true, code: true },
  });
  const branchByCode = new Map(
    branches.filter((b) => canAccessBranch(ctx, b.id)).map((b) => [b.code.toUpperCase(), b.id]),
  );
  const existing = await db.member.findMany({
    where: { organizationId: ctx.organizationId },
    select: { email: true, phone: true },
  });
  const seenEmails = new Set(existing.map((m) => m.email).filter(Boolean) as string[]);
  const seenPhones = new Set(existing.map((m) => m.phone).filter(Boolean) as string[]);

  const preview: ImportPreviewRow[] = rows.map((row, i) => {
    const line = i + 2;
    const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || `Row ${line}`;
    const code = (row.home_branch_code ?? "").toUpperCase();
    const homeBranchId = code ? branchByCode.get(code) : defaultBranchId;
    if (!homeBranchId)
      return {
        line,
        name,
        status: "invalid",
        messages: [`Unknown branch code "${row.home_branch_code}"`],
      };
    const parsed = memberInputSchema.safeParse({
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      dateOfBirth: row.date_of_birth,
      tags: row.tags?.replaceAll(";", ","),
      homeBranchId,
      confirmDuplicate: "true",
    });
    if (!parsed.success)
      return {
        line,
        name,
        status: "invalid",
        messages: parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`),
      };
    const input = parsed.data;
    const phone = input.phone ? normalizePhone(input.phone) : undefined;
    if ((input.email && seenEmails.has(input.email)) || (phone && seenPhones.has(phone))) {
      return {
        line,
        name,
        status: "duplicate",
        messages: ["Same phone or email as an existing member or an earlier row"],
        input,
      };
    }
    if (input.email) seenEmails.add(input.email);
    if (phone) seenPhones.add(phone);
    return { line, name, status: "ready", messages: [], input };
  });
  return {
    rows: preview,
    counts: {
      ready: preview.filter((r) => r.status === "ready").length,
      duplicate: preview.filter((r) => r.status === "duplicate").length,
      invalid: preview.filter((r) => r.status === "invalid").length,
    },
  };
}

/** Import all "ready" rows in one transaction (all or nothing) and record the run. */
export async function commitMemberImport(
  db: Database,
  ctx: OrganizationContext,
  csv: string,
  defaultBranchId: string,
  fileName?: string,
) {
  const preview = await previewMemberImport(db, ctx, csv, defaultBranchId);
  const ready = preview.rows.filter((r) => r.status === "ready");
  if (ready.length === 0) throw new ConflictError("There are no new members to import.");
  await assertWithinLimit(db, ctx.organizationId, "members", ready.length);
  return db.$transaction(
    async (tx) => {
      for (const row of ready) await createMemberInTx(tx, ctx, row.input!);
      const run = await tx.importRun.create({
        data: {
          organizationId: ctx.organizationId,
          type: "members",
          fileName,
          status: "COMPLETED",
          totalRows: preview.rows.length,
          createdRows: ready.length,
          skippedRows: preview.rows.length - ready.length,
          errors: preview.rows
            .filter((r) => r.status !== "ready")
            .map((r) => ({ line: r.line, status: r.status, messages: r.messages })),
          createdById: ctx.userId,
        },
      });
      await recordAudit(tx, {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "import.members",
        entityType: "import_run",
        entityId: run.id,
        metadata: { created: ready.length },
      });
      return run;
    },
    { timeout: 60_000 },
  );
}

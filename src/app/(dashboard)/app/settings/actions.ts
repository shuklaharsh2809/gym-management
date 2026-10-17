"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { commitMemberImport, previewMemberImport } from "@/modules/imports/members";
import {
  createWebhookEndpoint,
  sendTestEvent,
  setWebhookActive,
} from "@/modules/integrations/webhooks";
import { markNotificationsRead } from "@/modules/notifications/service";
import { updateOrganizationSettings } from "@/modules/organizations/service";
import { formDataToObject, parseInput, runAction, type ActionResult } from "@/server/actions";
import { requireOrganizationContext } from "@/server/auth/session";
import { db } from "@/server/database/client";

type State = ActionResult<unknown> | null;

export async function updateSettingsAction(
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "settings.update",
    () =>
      updateOrganizationSettings(
        db,
        ctx,
        parseInput(
          z.object({
            memberVisibility: z.enum(["ORGANIZATION", "HOME_BRANCH"]),
            checkInDuplicateWindowMinutes: z.coerce.number().int().min(0).max(1440),
          }),
          formDataToObject(formData),
        ),
      ),
    "Settings saved.",
  );
  revalidatePath("/app", "layout");
  return result;
}

export async function markReadAction(notificationId: string | null): Promise<void> {
  const ctx = await requireOrganizationContext();
  await markNotificationsRead(db, ctx, notificationId ?? undefined);
  revalidatePath("/app", "layout");
}

export async function createWebhookAction(
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction("webhook.create", async () => {
    const input = parseInput(
      z.object({
        url: z.string().trim().min(8, "Enter a URL").max(500),
        description: z.string().max(200).optional(),
      }),
      formDataToObject(formData),
    );
    const { secret } = await createWebhookEndpoint(db, ctx, {
      ...input,
      events: formData.getAll("events").map(String),
    });
    return { secret };
  });
  revalidatePath("/app/settings/integrations");
  if (result.ok)
    return {
      ok: true,
      data: result.data,
      message: `Endpoint added. Signing secret (shown once): ${result.data.secret}`,
    };
  return result;
}

export async function webhookToggleAction(
  endpointId: string,
  active: boolean,
  _prev: State,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "webhook.toggle",
    () => setWebhookActive(db, ctx, endpointId, active),
    active ? "Enabled." : "Disabled.",
  );
  revalidatePath("/app/settings/integrations");
  return result;
}

export async function webhookTestAction(
  endpointId: string,
  _prev: State,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "webhook.test",
    () => sendTestEvent(db, ctx, endpointId),
    "Test event queued. It is sent by the next job run.",
  );
  revalidatePath("/app/settings/integrations");
  return result;
}

export interface ImportPreviewState {
  ok: boolean;
  message?: string;
  csv?: string;
  fileName?: string;
  branchId?: string;
  committed?: boolean;
  counts?: { ready: number; duplicate: number; invalid: number };
  rows?: { line: number; name: string; status: string; messages: string[] }[];
}

async function readCsv(formData: FormData) {
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > 2_000_000) throw new Error("File is larger than 2 MB.");
    return { csv: await file.text(), fileName: file.name };
  }
  return {
    csv: String(formData.get("csv") ?? ""),
    fileName: String(formData.get("fileName") ?? "") || undefined,
  };
}

export async function importMembersAction(
  _prev: ImportPreviewState | null,
  formData: FormData,
): Promise<ImportPreviewState> {
  const ctx = await requireOrganizationContext();
  const branchId = String(formData.get("branchId") ?? "");
  const commit = formData.get("intent") === "commit";
  const result = await runAction("import.members", async () => {
    const { csv, fileName } = await readCsv(formData);
    if (commit) {
      const run = await commitMemberImport(db, ctx, csv, branchId, fileName);
      return {
        committed: true,
        message: `Imported ${run.createdRows} member(s); skipped ${run.skippedRows}.`,
      };
    }
    const preview = await previewMemberImport(db, ctx, csv, branchId);
    return {
      csv,
      fileName,
      counts: preview.counts,
      rows: preview.rows.map(({ line, name, status, messages }) => ({
        line,
        name,
        status,
        messages,
      })),
    };
  });
  if (!result.ok) return { ok: false, message: result.message };
  if (commit) revalidatePath("/app/members");
  return { ok: true, branchId, ...result.data };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { memberInputSchema, memberNoteSchema } from "@/modules/members/schemas";
import {
  addMemberNote,
  createMember,
  DuplicateMemberError,
  setMemberArchived,
  updateMember,
} from "@/modules/members/service";
import { cancelSchema, extendSchema, freezeSchema } from "@/modules/memberships/schemas";
import {
  cancelMembership,
  extendMembership,
  freezeMembership,
  resumeMembership,
} from "@/modules/memberships/service";
import { membershipSaleSchema } from "@/modules/billing/schemas";
import { sellMembership } from "@/modules/billing/service";
import {
  formDataToObject,
  parseInput,
  runAction,
  withSubmittedValues,
  type ActionResult,
} from "@/server/actions";
import { requireOrganizationContext } from "@/server/auth/session";
import { db } from "@/server/database/client";
import { moneyFieldsToMinor } from "@/server/forms";

type State = ActionResult<unknown> | null;

type Duplicates = { duplicates: DuplicateMemberError["duplicates"] };

/** Run a member write; a possible duplicate becomes data instead of a generic error. */
async function catchingDuplicates<T>(fn: () => Promise<T>): Promise<T | Duplicates> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof DuplicateMemberError) return { duplicates: error.duplicates };
    throw error;
  }
}

/** The form turns this field error into a "this is a different person" confirmation checkbox. */
function duplicateResult(found: Duplicates, formData: FormData): ActionResult<unknown> {
  return {
    ok: false,
    message: "A member with the same phone number or email already exists.",
    fieldErrors: { confirmDuplicate: found.duplicates.map((d) => `${d.name} (${d.memberNumber})`) },
    values: formDataToObject(formData),
  };
}

function readMember(formData: FormData) {
  return parseInput(memberInputSchema, formDataToObject(formData));
}

export async function createMemberAction(
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction("member.create", () =>
    catchingDuplicates(async () => (await createMember(db, ctx, readMember(formData))).id),
  );
  if (!result.ok) return withSubmittedValues(result, formData);
  if (typeof result.data !== "string") return duplicateResult(result.data, formData);
  revalidatePath("/app/members");
  redirect(`/app/members/${result.data}?created=1`);
}

export async function updateMemberAction(
  memberId: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction("member.update", () =>
    catchingDuplicates(async () => {
      await updateMember(db, ctx, memberId, readMember(formData));
      return "ok" as const;
    }),
  );
  if (!result.ok) return withSubmittedValues(result, formData);
  if (result.data !== "ok") return duplicateResult(result.data, formData);
  revalidatePath(`/app/members/${memberId}`);
  redirect(`/app/members/${memberId}?updated=1`);
}

export async function setMemberArchivedAction(
  memberId: string,
  archived: boolean,
  _prev: State,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "member.archive",
    () => setMemberArchived(db, ctx, memberId, archived),
    archived ? "Member archived." : "Member restored.",
  );
  if (result.ok) revalidatePath(`/app/members/${memberId}`);
  return result;
}

export async function addMemberNoteAction(
  memberId: string,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction(
    "member.note",
    async () => {
      const { body } = parseInput(memberNoteSchema, formDataToObject(formData));
      await addMemberNote(db, ctx, memberId, body);
    },
    "Note added.",
  );
  if (result.ok) revalidatePath(`/app/members/${memberId}`);
  return result;
}

export async function sellMembershipAction(
  memberId: string,
  previousMembershipId: string | null,
  _prev: State,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const ctx = await requireOrganizationContext();
  const result = await runAction("membership.sell", async () => {
    const values = moneyFieldsToMinor(
      {
        ...formDataToObject(formData),
        discountMinor: formData.get("discount"),
        paymentAmountMinor: formData.get("paymentAmount"),
      },
      ["discountMinor", "paymentAmountMinor"],
      ctx.organization.currency,
    );
    const input = parseInput(membershipSaleSchema, values);
    return sellMembership(db, ctx, memberId, {
      ...input,
      previousMembershipId: previousMembershipId ?? undefined,
    });
  });
  if (result.ok) {
    revalidatePath(`/app/members/${memberId}`);
    redirect(`/app/finance/invoices/${result.data.invoiceId}?sold=1`);
  }
  return withSubmittedValues(result, formData);
}

function membershipAction<T>(
  name: string,
  schema: { safeParse: (v: unknown) => unknown } | null,
  run: (
    ctx: Awaited<ReturnType<typeof requireOrganizationContext>>,
    membershipId: string,
    input: T,
  ) => Promise<void>,
  message: string,
) {
  return async (
    membershipId: string,
    memberId: string,
    _prev: State,
    formData: FormData,
  ): Promise<ActionResult<unknown>> => {
    const ctx = await requireOrganizationContext();
    const result = await runAction(
      name,
      async () => {
        const input = (
          schema ? parseInput(schema as never, formDataToObject(formData)) : undefined
        ) as T;
        await run(ctx, membershipId, input);
      },
      message,
    );
    if (result.ok) revalidatePath(`/app/members/${memberId}`);
    return result;
  };
}

const freeze = membershipAction<{ days: number; reason?: string }>(
  "membership.freeze",
  freezeSchema,
  (ctx, id, input) => freezeMembership(db, ctx, id, input),
  "Membership frozen. The end date moved out by the freeze length.",
);
const resume = membershipAction<undefined>(
  "membership.resume",
  null,
  (ctx, id) => resumeMembership(db, ctx, id),
  "Membership resumed. Unused freeze days were returned.",
);
const extend = membershipAction<{ days: number; reason: string }>(
  "membership.extend",
  extendSchema,
  (ctx, id, input) => extendMembership(db, ctx, id, input),
  "Membership extended.",
);
const cancel = membershipAction<{ reason: string }>(
  "membership.cancel",
  cancelSchema,
  (ctx, id, input) => cancelMembership(db, ctx, id, input),
  "Membership cancelled. Issue any refund from the invoice.",
);

export async function freezeMembershipAction(
  membershipId: string,
  memberId: string,
  prev: State,
  formData: FormData,
) {
  return freeze(membershipId, memberId, prev, formData);
}
export async function resumeMembershipAction(
  membershipId: string,
  memberId: string,
  prev: State,
  formData: FormData,
) {
  return resume(membershipId, memberId, prev, formData);
}
export async function extendMembershipAction(
  membershipId: string,
  memberId: string,
  prev: State,
  formData: FormData,
) {
  return extend(membershipId, memberId, prev, formData);
}
export async function cancelMembershipAction(
  membershipId: string,
  memberId: string,
  prev: State,
  formData: FormData,
) {
  return cancel(membershipId, memberId, prev, formData);
}

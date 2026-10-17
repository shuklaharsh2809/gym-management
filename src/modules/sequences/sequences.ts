import type { DbClient } from "@/server/database/client";

export type SequenceKey = "member" | "invoice" | "receipt" | "equipment" | "purchase_order";

const PREFIX: Record<SequenceKey, string> = {
  member: "M",
  invoice: "INV",
  receipt: "RCP",
  equipment: "EQ",
  purchase_order: "PO",
};

/**
 * Next value of a per-organization counter. Atomic: concurrent callers lock the same row,
 * so numbers are never duplicated. Must be called inside the transaction that uses it,
 * so a rolled-back transaction doesn't leave a gap.
 */
export async function nextSequenceValue(db: DbClient, organizationId: string, key: SequenceKey) {
  const rows = await db.$queryRaw<{ value: number }[]>`
    INSERT INTO organization_sequences (organization_id, key, next_value)
    VALUES (${organizationId}::uuid, ${key}, 2)
    ON CONFLICT (organization_id, key)
    DO UPDATE SET next_value = organization_sequences.next_value + 1
    RETURNING next_value - 1 AS value`;
  return Number(rows[0]!.value);
}

export async function nextNumber(db: DbClient, organizationId: string, key: SequenceKey) {
  const value = await nextSequenceValue(db, organizationId, key);
  return `${PREFIX[key]}-${String(value).padStart(key === "member" ? 5 : 6, "0")}`;
}

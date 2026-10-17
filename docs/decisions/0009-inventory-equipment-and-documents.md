# ADR 0009: Inventory ledger, equipment lifecycle and member documents

- **Status:** Accepted
- **Date:** 2026-10-17

## Inventory

- Stock changes are an append-only **ledger** (`stock_movements`, signed quantity with a type-sign CHECK).
  `product_stock` holds the current quantity per branch and is only changed together with a movement.
- Negative stock is impossible: a CHECK constraint on `product_stock.quantity >= 0`. Decreases use
  `UPDATE` (row-locked) because Postgres evaluates CHECKs on the proposed row before resolving
  `ON CONFLICT`; increases use an upsert. Concurrent sales of the last unit therefore can't oversell.
- A POS **sale is an invoice** with `source = POS` and product lines, not a separate entity, so receipts,
  payments, refunds and reports work the same way as memberships. Returns create `RETURN` movements and a
  refund for the exact line value.
- Receiving a purchase order adds stock and (optionally) records a linked `SUPPLIES` expense.

## Equipment

- Equipment has asset tags from a per-organization sequence, maintenance schedules (interval in days)
  and work orders. Equipment status (in use / under maintenance / out of service) is derived from open
  work orders; completing preventive work advances its schedule. Transfers between branches are recorded
  and move open work orders with the equipment. Retired equipment keeps its history.

## Member documents

- Waivers, consent records, ID proofs and medical documents (≤ 5 MB) are stored in Postgres (`bytea`)
  so tenant isolation, transactions and backups cover them with no extra storage service.
- Types are detected from the file signature (PDF, PNG, JPEG, WebP), not the name or client type.
- Medical (and any "sensitive") documents need `members.sensitive.read` to list or download.
- Downloads go through `/app/documents/[id]`, which re-checks tenant, member visibility and sensitivity,
  sends `Content-Disposition: attachment`, `no-store` and `nosniff`, and is audited.
- Move to object storage (e.g. Vercel Blob, private) if volumes grow; the download route stays the gate.

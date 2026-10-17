-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "InvoiceSource" AS ENUM ('MEMBERSHIP', 'POS', 'MANUAL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'ONLINE');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "CheckInStatus" AS ENUM ('ALLOWED', 'DENIED');

-- CreateEnum
CREATE TYPE "CheckInMethod" AS ENUM ('MANUAL', 'QR');

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "member_id" UUID,
    "number" TEXT NOT NULL,
    "source" "InvoiceSource" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "currency" CHAR(3) NOT NULL,
    "subtotal_minor" INTEGER NOT NULL,
    "discount_minor" INTEGER NOT NULL DEFAULT 0,
    "tax_minor" INTEGER NOT NULL,
    "total_minor" INTEGER NOT NULL,
    "amount_paid_minor" INTEGER NOT NULL DEFAULT 0,
    "amount_refunded_minor" INTEGER NOT NULL DEFAULT 0,
    "idempotency_key" TEXT,
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" DATE,
    "notes" TEXT,
    "voided_at" TIMESTAMPTZ(3),
    "void_reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_minor" INTEGER NOT NULL,
    "discount_minor" INTEGER NOT NULL DEFAULT 0,
    "tax_rate_bps" INTEGER NOT NULL,
    "tax_inclusive" BOOLEAN NOT NULL,
    "net_minor" INTEGER NOT NULL,
    "tax_minor" INTEGER NOT NULL,
    "total_minor" INTEGER NOT NULL,
    "membership_id" UUID,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "member_id" UUID,
    "receipt_number" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "amount_refunded_minor" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by_id" UUID,
    "idempotency_key" TEXT,
    "provider" TEXT,
    "provider_payment_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refunded_by_id" UUID,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_reference" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "failure_reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_events" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "provider_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "membership_id" UUID,
    "status" "CheckInStatus" NOT NULL,
    "denial_reason" TEXT,
    "method" "CheckInMethod" NOT NULL DEFAULT 'MANUAL',
    "checked_in_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked_out_at" TIMESTAMPTZ(3),
    "recorded_by_id" UUID,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_organization_id_member_id_idx" ON "invoices"("organization_id", "member_id");

-- CreateIndex
CREATE INDEX "invoices_organization_id_status_idx" ON "invoices"("organization_id", "status");

-- CreateIndex
CREATE INDEX "invoices_organization_id_branch_id_issued_at_idx" ON "invoices"("organization_id", "branch_id", "issued_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_id_organization_id_key" ON "invoices"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organization_id_number_key" ON "invoices"("organization_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organization_id_idempotency_key_key" ON "invoices"("organization_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "invoice_lines_organization_id_invoice_id_idx" ON "invoice_lines"("organization_id", "invoice_id");

-- CreateIndex
CREATE INDEX "invoice_lines_membership_id_idx" ON "invoice_lines"("membership_id");

-- CreateIndex
CREATE INDEX "payments_organization_id_branch_id_received_at_idx" ON "payments"("organization_id", "branch_id", "received_at");

-- CreateIndex
CREATE INDEX "payments_organization_id_invoice_id_idx" ON "payments"("organization_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_id_organization_id_key" ON "payments"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_organization_id_receipt_number_key" ON "payments"("organization_id", "receipt_number");

-- CreateIndex
CREATE UNIQUE INDEX "payments_organization_id_idempotency_key_key" ON "payments"("organization_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_provider_payment_id_key" ON "payments"("provider", "provider_payment_id");

-- CreateIndex
CREATE INDEX "refunds_organization_id_created_at_idx" ON "refunds"("organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_organization_id_idempotency_key_key" ON "refunds"("organization_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_provider_reference_key" ON "payment_attempts"("provider_reference");

-- CreateIndex
CREATE INDEX "payment_attempts_organization_id_invoice_id_idx" ON "payment_attempts"("organization_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_events_provider_event_id_key" ON "provider_events"("provider", "event_id");

-- CreateIndex
CREATE INDEX "check_ins_organization_id_branch_id_checked_in_at_idx" ON "check_ins"("organization_id", "branch_id", "checked_in_at");

-- CreateIndex
CREATE INDEX "check_ins_organization_id_member_id_checked_in_at_idx" ON "check_ins"("organization_id", "member_id", "checked_in_at");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_organization_id_fkey" FOREIGN KEY ("invoice_id", "organization_id") REFERENCES "invoices"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "gym_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_organization_id_fkey" FOREIGN KEY ("invoice_id", "organization_id") REFERENCES "invoices"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_organization_id_fkey" FOREIGN KEY ("payment_id", "organization_id") REFERENCES "payments"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_invoice_id_organization_id_fkey" FOREIGN KEY ("invoice_id", "organization_id") REFERENCES "invoices"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_invoice_id_organization_id_fkey" FOREIGN KEY ("invoice_id", "organization_id") REFERENCES "invoices"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_member_id_organization_id_fkey" FOREIGN KEY ("member_id", "organization_id") REFERENCES "members"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "gym_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Same-organization guard for optional references (composite FKs can't be optional in Prisma).
-- Usage: trigger argument 0 = referenced table, argument 1 = referencing column.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fg_assert_same_organization() RETURNS trigger AS $$
DECLARE
  ref_table text := TG_ARGV[0];
  ref_column text := TG_ARGV[1];
  ref_id uuid;
  matches boolean;
BEGIN
  EXECUTE format('SELECT ($1).%I::uuid', ref_column) USING NEW INTO ref_id;
  IF ref_id IS NULL THEN
    RETURN NEW;
  END IF;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE id = $1 AND organization_id = $2)', ref_table)
    USING ref_id, NEW.organization_id INTO matches;
  IF NOT matches THEN
    RAISE EXCEPTION 'Cross-organization reference from %.% to %', TG_TABLE_NAME, ref_column, ref_table
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoices_member_same_org BEFORE INSERT OR UPDATE OF member_id ON invoices
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('members', 'member_id');
CREATE TRIGGER payments_member_same_org BEFORE INSERT OR UPDATE OF member_id ON payments
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('members', 'member_id');
CREATE TRIGGER invoice_lines_membership_same_org BEFORE INSERT OR UPDATE OF membership_id ON invoice_lines
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('gym_memberships', 'membership_id');
CREATE TRIGGER check_ins_membership_same_org BEFORE INSERT OR UPDATE OF membership_id ON check_ins
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('gym_memberships', 'membership_id');

-- ---------------------------------------------------------------------------
-- Financial integrity
-- ---------------------------------------------------------------------------
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_amounts_check" CHECK (
    "subtotal_minor" >= 0 AND "discount_minor" >= 0 AND "tax_minor" >= 0 AND "total_minor" >= 0
    AND "total_minor" = "subtotal_minor" + "tax_minor"
  ),
  ADD CONSTRAINT "invoices_paid_check" CHECK ("amount_paid_minor" >= 0 AND "amount_paid_minor" <= "total_minor"),
  ADD CONSTRAINT "invoices_refunded_check" CHECK ("amount_refunded_minor" >= 0 AND "amount_refunded_minor" <= "amount_paid_minor"),
  ADD CONSTRAINT "invoices_status_check" CHECK (
    ("status" = 'PAID' AND "amount_paid_minor" = "total_minor")
    OR ("status" = 'OPEN' AND "amount_paid_minor" < "total_minor")
    OR ("status" = 'VOID' AND "amount_paid_minor" = 0 AND "voided_at" IS NOT NULL)
  ),
  ADD CONSTRAINT "invoices_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "invoice_lines"
  ADD CONSTRAINT "invoice_lines_amounts_check" CHECK (
    "quantity" > 0 AND "unit_price_minor" >= 0 AND "discount_minor" >= 0
    AND "net_minor" >= 0 AND "tax_minor" >= 0 AND "total_minor" = "net_minor" + "tax_minor"
    AND "tax_rate_bps" BETWEEN 0 AND 10000
  );

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_check" CHECK ("amount_minor" > 0),
  ADD CONSTRAINT "payments_refunded_check" CHECK ("amount_refunded_minor" >= 0 AND "amount_refunded_minor" <= "amount_minor");

ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_check" CHECK ("amount_minor" > 0);
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_amount_check" CHECK ("amount_minor" > 0);

ALTER TABLE "check_ins"
  ADD CONSTRAINT "check_ins_denial_check" CHECK (("status" = 'DENIED') = ("denial_reason" IS NOT NULL)),
  ADD CONSTRAINT "check_ins_checkout_check" CHECK ("checked_out_at" IS NULL OR "checked_out_at" >= "checked_in_at");

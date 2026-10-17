-- CreateEnum
CREATE TYPE "MemberVisibility" AS ENUM ('ORGANIZATION', 'HOME_BRANCH');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PlanKind" AS ENUM ('TIME_BASED', 'DAY_PASS', 'CLASS_PACK', 'PT_PACK');

-- CreateEnum
CREATE TYPE "DurationUnit" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GymMembershipStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MembershipChangeType" AS ENUM ('CREATED', 'FROZEN', 'RESUMED', 'EXTENDED', 'CANCELLED', 'RENEWED');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "check_in_duplicate_window_minutes" INTEGER NOT NULL DEFAULT 180,
ADD COLUMN     "member_visibility" "MemberVisibility" NOT NULL DEFAULT 'ORGANIZATION';

-- CreateTable
CREATE TABLE "organization_sequences" (
    "organization_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "next_value" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "organization_sequences_pkey" PRIMARY KEY ("organization_id","key")
);

-- CreateTable
CREATE TABLE "members" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "home_branch_id" UUID NOT NULL,
    "member_number" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "date_of_birth" DATE,
    "address_line1" TEXT,
    "city" TEXT,
    "postal_code" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "emergency_contact_relation" TEXT,
    "medical_notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_notes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "author_id" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_plans" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "PlanKind" NOT NULL DEFAULT 'TIME_BASED',
    "duration_unit" "DurationUnit" NOT NULL,
    "duration_count" INTEGER NOT NULL,
    "session_count" INTEGER,
    "price_minor" INTEGER NOT NULL,
    "joining_fee_minor" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "tax_rate_bps" INTEGER NOT NULL DEFAULT 0,
    "tax_inclusive" BOOLEAN NOT NULL DEFAULT true,
    "grace_period_days" INTEGER NOT NULL DEFAULT 0,
    "max_freeze_days" INTEGER NOT NULL DEFAULT 0,
    "all_branches" BOOLEAN NOT NULL DEFAULT true,
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_branches" (
    "plan_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,

    CONSTRAINT "plan_branches_pkey" PRIMARY KEY ("plan_id","branch_id")
);

-- CreateTable
CREATE TABLE "gym_memberships" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "status" "GymMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "plan_name" TEXT NOT NULL,
    "plan_kind" "PlanKind" NOT NULL,
    "price_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "grace_period_days" INTEGER NOT NULL DEFAULT 0,
    "all_branches" BOOLEAN NOT NULL,
    "sessions_total" INTEGER,
    "sessions_used" INTEGER NOT NULL DEFAULT 0,
    "frozen_from" DATE,
    "frozen_until" DATE,
    "freeze_days_used" INTEGER NOT NULL DEFAULT 0,
    "max_freeze_days" INTEGER NOT NULL DEFAULT 0,
    "cancelled_at" TIMESTAMPTZ(3),
    "cancel_reason" TEXT,
    "previous_membership_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "gym_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_changes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "type" "MembershipChangeType" NOT NULL,
    "from_end_date" DATE,
    "to_end_date" DATE,
    "days" INTEGER,
    "reason" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "members_organization_id_last_name_first_name_idx" ON "members"("organization_id", "last_name", "first_name");

-- CreateIndex
CREATE INDEX "members_organization_id_phone_idx" ON "members"("organization_id", "phone");

-- CreateIndex
CREATE INDEX "members_organization_id_email_idx" ON "members"("organization_id", "email");

-- CreateIndex
CREATE INDEX "members_organization_id_home_branch_id_idx" ON "members"("organization_id", "home_branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "members_id_organization_id_key" ON "members"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "members_organization_id_member_number_key" ON "members"("organization_id", "member_number");

-- CreateIndex
CREATE INDEX "member_notes_organization_id_member_id_created_at_idx" ON "member_notes"("organization_id", "member_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "membership_plans_id_organization_id_key" ON "membership_plans"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_plans_organization_id_name_key" ON "membership_plans"("organization_id", "name");

-- CreateIndex
CREATE INDEX "gym_memberships_organization_id_member_id_idx" ON "gym_memberships"("organization_id", "member_id");

-- CreateIndex
CREATE INDEX "gym_memberships_organization_id_end_date_idx" ON "gym_memberships"("organization_id", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "gym_memberships_id_organization_id_key" ON "gym_memberships"("id", "organization_id");

-- CreateIndex
CREATE INDEX "membership_changes_organization_id_membership_id_created_at_idx" ON "membership_changes"("organization_id", "membership_id", "created_at");

-- AddForeignKey
ALTER TABLE "organization_sequences" ADD CONSTRAINT "organization_sequences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_home_branch_id_organization_id_fkey" FOREIGN KEY ("home_branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_notes" ADD CONSTRAINT "member_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_notes" ADD CONSTRAINT "member_notes_member_id_organization_id_fkey" FOREIGN KEY ("member_id", "organization_id") REFERENCES "members"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_plans" ADD CONSTRAINT "membership_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_branches" ADD CONSTRAINT "plan_branches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_branches" ADD CONSTRAINT "plan_branches_plan_id_organization_id_fkey" FOREIGN KEY ("plan_id", "organization_id") REFERENCES "membership_plans"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_branches" ADD CONSTRAINT "plan_branches_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_memberships" ADD CONSTRAINT "gym_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_memberships" ADD CONSTRAINT "gym_memberships_member_id_organization_id_fkey" FOREIGN KEY ("member_id", "organization_id") REFERENCES "members"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_memberships" ADD CONSTRAINT "gym_memberships_plan_id_organization_id_fkey" FOREIGN KEY ("plan_id", "organization_id") REFERENCES "membership_plans"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_memberships" ADD CONSTRAINT "gym_memberships_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_changes" ADD CONSTRAINT "membership_changes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_changes" ADD CONSTRAINT "membership_changes_membership_id_organization_id_fkey" FOREIGN KEY ("membership_id", "organization_id") REFERENCES "gym_memberships"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written integrity constraints
-- ---------------------------------------------------------------------------

ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_check_in_window_check"
    CHECK ("check_in_duplicate_window_minutes" BETWEEN 0 AND 1440);

ALTER TABLE "organization_sequences"
  ADD CONSTRAINT "organization_sequences_next_value_check" CHECK ("next_value" >= 1);

ALTER TABLE "members"
  ADD CONSTRAINT "members_name_check" CHECK (length(btrim("first_name")) > 0 AND length(btrim("last_name")) > 0),
  ADD CONSTRAINT "members_email_lowercase_check" CHECK ("email" IS NULL OR "email" = lower("email")),
  ADD CONSTRAINT "members_archived_check" CHECK ("status" <> 'ARCHIVED' OR "archived_at" IS NOT NULL);

ALTER TABLE "membership_plans"
  ADD CONSTRAINT "membership_plans_duration_check" CHECK ("duration_count" BETWEEN 1 AND 3650),
  ADD CONSTRAINT "membership_plans_price_check" CHECK ("price_minor" >= 0 AND "joining_fee_minor" >= 0),
  ADD CONSTRAINT "membership_plans_tax_check" CHECK ("tax_rate_bps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "membership_plans_days_check" CHECK ("grace_period_days" >= 0 AND "max_freeze_days" >= 0),
  ADD CONSTRAINT "membership_plans_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "membership_plans_sessions_check" CHECK (
    ("kind" IN ('CLASS_PACK', 'PT_PACK') AND "session_count" > 0)
    OR ("kind" NOT IN ('CLASS_PACK', 'PT_PACK') AND "session_count" IS NULL)
  );

ALTER TABLE "gym_memberships"
  ADD CONSTRAINT "gym_memberships_dates_check" CHECK ("end_date" >= "start_date"),
  ADD CONSTRAINT "gym_memberships_price_check" CHECK ("price_minor" >= 0),
  ADD CONSTRAINT "gym_memberships_sessions_check" CHECK (
    "sessions_used" >= 0 AND ("sessions_total" IS NULL OR "sessions_used" <= "sessions_total")
  ),
  ADD CONSTRAINT "gym_memberships_freeze_check" CHECK (
    ("frozen_from" IS NULL) = ("frozen_until" IS NULL)
    AND ("frozen_until" IS NULL OR "frozen_until" >= "frozen_from")
    AND "freeze_days_used" >= 0
  ),
  ADD CONSTRAINT "gym_memberships_frozen_status_check" CHECK ("status" <> 'FROZEN' OR "frozen_from" IS NOT NULL),
  ADD CONSTRAINT "gym_memberships_cancelled_check" CHECK ("status" <> 'CANCELLED' OR "cancelled_at" IS NOT NULL);

CREATE INDEX "members_search_name_idx" ON "members" ("organization_id", lower("first_name" || ' ' || "last_name"));

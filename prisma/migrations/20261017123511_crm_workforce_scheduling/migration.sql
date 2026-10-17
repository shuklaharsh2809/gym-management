-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'TRIAL_BOOKED', 'TRIAL_COMPLETED', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WALK_IN', 'WEBSITE', 'REFERRAL', 'PHONE', 'CAMPAIGN', 'SOCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM ('NOTE', 'CALL', 'EMAIL', 'MESSAGE', 'VISIT', 'STAGE_CHANGE', 'FOLLOW_UP_DONE', 'CONVERTED');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'UNPAID', 'OTHER');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('BOOKED', 'WAITLISTED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "TrainingSessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "source" "LeadSource" NOT NULL,
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "interest" TEXT,
    "owner_membership_id" UUID,
    "next_follow_up_at" TIMESTAMPTZ(3),
    "lost_reason" TEXT,
    "converted_member_id" UUID,
    "converted_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "type" "LeadActivityType" NOT NULL,
    "body" TEXT,
    "from_stage" "LeadStage",
    "to_stage" "LeadStage",
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "note" TEXT,
    "assigned_to_membership_id" UUID,
    "completed_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "primary_branch_id" UUID NOT NULL,
    "membership_id" UUID,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "job_title" TEXT NOT NULL,
    "employment_type" "EmploymentType" NOT NULL,
    "status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "is_trainer" BOOLEAN NOT NULL DEFAULT false,
    "specializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bio" TEXT,
    "monthly_salary_minor" INTEGER,
    "commission_bps" INTEGER,
    "currency" CHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "type" "LeaveType" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "decision_note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_types" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "default_capacity" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#047857',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "class_type_id" UUID NOT NULL,
    "room_id" UUID,
    "trainer_id" UUID,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "series_id" UUID,
    "cancelled_reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "waitlist_position" INTEGER,
    "membership_id" UUID,
    "credit_consumed" BOOLEAN NOT NULL DEFAULT false,
    "booked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "TrainingSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "membership_id" UUID,
    "credit_consumed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_organization_id_stage_idx" ON "leads"("organization_id", "stage");

-- CreateIndex
CREATE INDEX "leads_organization_id_next_follow_up_at_idx" ON "leads"("organization_id", "next_follow_up_at");

-- CreateIndex
CREATE UNIQUE INDEX "leads_id_organization_id_key" ON "leads"("id", "organization_id");

-- CreateIndex
CREATE INDEX "lead_activities_organization_id_lead_id_created_at_idx" ON "lead_activities"("organization_id", "lead_id", "created_at");

-- CreateIndex
CREATE INDEX "follow_ups_organization_id_due_at_idx" ON "follow_ups"("organization_id", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "employees_membership_id_key" ON "employees"("membership_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_status_idx" ON "employees"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "employees_id_organization_id_key" ON "employees"("id", "organization_id");

-- CreateIndex
CREATE INDEX "shifts_organization_id_branch_id_starts_at_idx" ON "shifts"("organization_id", "branch_id", "starts_at");

-- CreateIndex
CREATE INDEX "shifts_organization_id_employee_id_starts_at_idx" ON "shifts"("organization_id", "employee_id", "starts_at");

-- CreateIndex
CREATE INDEX "leave_requests_organization_id_status_idx" ON "leave_requests"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_id_organization_id_key" ON "rooms"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_branch_id_name_key" ON "rooms"("branch_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "class_types_id_organization_id_key" ON "class_types"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_types_organization_id_name_key" ON "class_types"("organization_id", "name");

-- CreateIndex
CREATE INDEX "class_sessions_organization_id_branch_id_starts_at_idx" ON "class_sessions"("organization_id", "branch_id", "starts_at");

-- CreateIndex
CREATE INDEX "class_sessions_trainer_id_starts_at_idx" ON "class_sessions"("trainer_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "class_sessions_id_organization_id_key" ON "class_sessions"("id", "organization_id");

-- CreateIndex
CREATE INDEX "bookings_organization_id_session_id_status_idx" ON "bookings"("organization_id", "session_id", "status");

-- CreateIndex
CREATE INDEX "bookings_organization_id_member_id_idx" ON "bookings"("organization_id", "member_id");

-- CreateIndex
CREATE INDEX "training_sessions_organization_id_trainer_id_starts_at_idx" ON "training_sessions"("organization_id", "trainer_id", "starts_at");

-- CreateIndex
CREATE INDEX "training_sessions_organization_id_member_id_idx" ON "training_sessions"("organization_id", "member_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "organization_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_member_id_fkey" FOREIGN KEY ("converted_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_organization_id_fkey" FOREIGN KEY ("lead_id", "organization_id") REFERENCES "leads"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_lead_id_organization_id_fkey" FOREIGN KEY ("lead_id", "organization_id") REFERENCES "leads"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_assigned_to_membership_id_fkey" FOREIGN KEY ("assigned_to_membership_id") REFERENCES "organization_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_primary_branch_id_organization_id_fkey" FOREIGN KEY ("primary_branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "organization_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_employee_id_organization_id_fkey" FOREIGN KEY ("employee_id", "organization_id") REFERENCES "employees"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_organization_id_fkey" FOREIGN KEY ("employee_id", "organization_id") REFERENCES "employees"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_types" ADD CONSTRAINT "class_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_class_type_id_organization_id_fkey" FOREIGN KEY ("class_type_id", "organization_id") REFERENCES "class_types"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_session_id_organization_id_fkey" FOREIGN KEY ("session_id", "organization_id") REFERENCES "class_sessions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_member_id_organization_id_fkey" FOREIGN KEY ("member_id", "organization_id") REFERENCES "members"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "gym_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_member_id_organization_id_fkey" FOREIGN KEY ("member_id", "organization_id") REFERENCES "members"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_trainer_id_organization_id_fkey" FOREIGN KEY ("trainer_id", "organization_id") REFERENCES "employees"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "gym_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Same-organization guards for optional references
-- ---------------------------------------------------------------------------
CREATE TRIGGER leads_owner_same_org BEFORE INSERT OR UPDATE OF owner_membership_id ON leads
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('organization_memberships', 'owner_membership_id');
CREATE TRIGGER leads_converted_member_same_org BEFORE INSERT OR UPDATE OF converted_member_id ON leads
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('members', 'converted_member_id');
CREATE TRIGGER follow_ups_assignee_same_org BEFORE INSERT OR UPDATE OF assigned_to_membership_id ON follow_ups
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('organization_memberships', 'assigned_to_membership_id');
CREATE TRIGGER employees_membership_same_org BEFORE INSERT OR UPDATE OF membership_id ON employees
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('organization_memberships', 'membership_id');
CREATE TRIGGER class_sessions_room_same_org BEFORE INSERT OR UPDATE OF room_id ON class_sessions
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('rooms', 'room_id');
CREATE TRIGGER class_sessions_trainer_same_org BEFORE INSERT OR UPDATE OF trainer_id ON class_sessions
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('employees', 'trainer_id');
CREATE TRIGGER bookings_membership_same_org BEFORE INSERT OR UPDATE OF membership_id ON bookings
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('gym_memberships', 'membership_id');
CREATE TRIGGER training_sessions_membership_same_org BEFORE INSERT OR UPDATE OF membership_id ON training_sessions
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('gym_memberships', 'membership_id');

-- ---------------------------------------------------------------------------
-- Integrity checks
-- ---------------------------------------------------------------------------
ALTER TABLE "leads"
  ADD CONSTRAINT "leads_name_check" CHECK (length(btrim("name")) > 0),
  ADD CONSTRAINT "leads_contact_check" CHECK ("phone" IS NOT NULL OR "email" IS NOT NULL),
  ADD CONSTRAINT "leads_lost_check" CHECK ("stage" <> 'LOST' OR "lost_reason" IS NOT NULL),
  ADD CONSTRAINT "leads_converted_check" CHECK (("converted_member_id" IS NULL) = ("converted_at" IS NULL));

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_dates_check" CHECK ("end_date" IS NULL OR "end_date" >= "start_date"),
  ADD CONSTRAINT "employees_pay_check" CHECK (
    ("monthly_salary_minor" IS NULL OR "monthly_salary_minor" >= 0)
    AND ("commission_bps" IS NULL OR "commission_bps" BETWEEN 0 AND 10000)
  );

ALTER TABLE "shifts" ADD CONSTRAINT "shifts_time_check" CHECK ("ends_at" > "starts_at" AND "ends_at" - "starts_at" <= interval '24 hours');
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_dates_check" CHECK ("end_date" >= "start_date");
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_capacity_check" CHECK ("capacity" BETWEEN 1 AND 1000);
ALTER TABLE "class_types"
  ADD CONSTRAINT "class_types_check" CHECK ("duration_minutes" BETWEEN 5 AND 480 AND "default_capacity" BETWEEN 1 AND 1000);
ALTER TABLE "class_sessions"
  ADD CONSTRAINT "class_sessions_time_check" CHECK ("ends_at" > "starts_at"),
  ADD CONSTRAINT "class_sessions_capacity_check" CHECK ("capacity" BETWEEN 1 AND 1000);
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_waitlist_check" CHECK (("status" = 'WAITLISTED') = ("waitlist_position" IS NOT NULL));
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_time_check" CHECK ("ends_at" > "starts_at");

-- One live booking per member per class (cancelled bookings don't count).
CREATE UNIQUE INDEX "bookings_one_live_per_member"
  ON "bookings" ("session_id", "member_id") WHERE "status" <> 'CANCELLED';

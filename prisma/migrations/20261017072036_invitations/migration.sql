-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "branch_scope" "BranchAccessScope" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "invited_by_id" UUID,
    "accepted_by_id" UUID,
    "accepted_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation_branches" (
    "invitation_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,

    CONSTRAINT "invitation_branches_pkey" PRIMARY KEY ("invitation_id","branch_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_organization_id_status_idx" ON "invitations"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_id_organization_id_key" ON "invitations"("id", "organization_id");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_branches" ADD CONSTRAINT "invitation_branches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_branches" ADD CONSTRAINT "invitation_branches_invitation_id_organization_id_fkey" FOREIGN KEY ("invitation_id", "organization_id") REFERENCES "invitations"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_branches" ADD CONSTRAINT "invitation_branches_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written integrity constraints
-- ---------------------------------------------------------------------------

-- At most one pending invitation per email per organization.
CREATE UNIQUE INDEX "invitations_one_pending_per_email"
  ON "invitations" ("organization_id", "email") WHERE "status" = 'PENDING';

ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_email_lowercase_check" CHECK ("email" = lower("email")),
  -- Ownership cannot be granted by invitation.
  ADD CONSTRAINT "invitations_role_check" CHECK ("role" <> 'OWNER'),
  ADD CONSTRAINT "invitations_admin_scope_check"
    CHECK ("role" <> 'ADMIN' OR "branch_scope" = 'ALL_BRANCHES'),
  ADD CONSTRAINT "invitations_accepted_check"
    CHECK ("status" <> 'ACCEPTED' OR ("accepted_at" IS NOT NULL AND "accepted_by_id" IS NOT NULL)),
  ADD CONSTRAINT "invitations_revoked_check" CHECK ("status" <> 'REVOKED' OR "revoked_at" IS NOT NULL);

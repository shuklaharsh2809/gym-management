-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('WAIVER', 'CONSENT', 'ID_PROOF', 'MEDICAL', 'OTHER');

-- CreateTable
CREATE TABLE "member_documents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "signed_at" TIMESTAMPTZ(3),
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_requests" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "locations" INTEGER,
    "message" TEXT NOT NULL,
    "ip_hash" TEXT,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_documents_organization_id_member_id_idx" ON "member_documents"("organization_id", "member_id");

-- CreateIndex
CREATE INDEX "contact_requests_created_at_idx" ON "contact_requests"("created_at");

-- AddForeignKey
ALTER TABLE "member_documents" ADD CONSTRAINT "member_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_documents" ADD CONSTRAINT "member_documents_member_id_organization_id_fkey" FOREIGN KEY ("member_id", "organization_id") REFERENCES "members"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "member_documents"
  ADD CONSTRAINT "member_documents_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 5242880 AND octet_length("content") = "size_bytes"),
  ADD CONSTRAINT "member_documents_medical_sensitive_check" CHECK ("kind" <> 'MEDICAL' OR "sensitive");
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_message_check" CHECK (length("message") BETWEEN 1 AND 4000);

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('ACTIVE', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE', 'RETIRED');

-- CreateEnum
CREATE TYPE "WorkOrderType" AS ENUM ('PREVENTIVE', 'CORRECTIVE');

-- CreateEnum
CREATE TYPE "WorkOrderPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'SALE', 'RETURN', 'ADJUSTMENT', 'DAMAGE', 'TRANSFER_OUT', 'TRANSFER_IN');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('RENT', 'UTILITIES', 'SALARIES', 'MAINTENANCE', 'EQUIPMENT', 'SUPPLIES', 'MARKETING', 'OTHER');

-- AlterTable
ALTER TABLE "invoice_lines" ADD COLUMN     "product_id" UUID;

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "asset_tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serial_number" TEXT,
    "purchase_date" DATE,
    "cost_minor" INTEGER,
    "currency" CHAR(3) NOT NULL,
    "supplier_id" UUID,
    "warranty_until" DATE,
    "location" TEXT,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "retired_at" TIMESTAMPTZ(3),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_schedules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "interval_days" INTEGER NOT NULL,
    "last_done_on" DATE,
    "next_due_on" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_work_orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "schedule_id" UUID,
    "type" "WorkOrderType" NOT NULL,
    "priority" "WorkOrderPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "takes_out_of_service" BOOLEAN NOT NULL DEFAULT false,
    "assigned_to_membership_id" UUID,
    "reported_by_id" UUID,
    "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "resolution" TEXT,
    "cost_minor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "maintenance_work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_transfers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "from_branch_id" UUID NOT NULL,
    "to_branch_id" UUID NOT NULL,
    "note" TEXT,
    "actor_id" UUID,
    "transferred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "barcode" TEXT,
    "price_minor" INTEGER NOT NULL,
    "cost_minor" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "tax_rate_bps" INTEGER NOT NULL DEFAULT 0,
    "tax_inclusive" BOOLEAN NOT NULL DEFAULT true,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_stock" (
    "product_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_stock_pkey" PRIMARY KEY ("product_id","branch_id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "purchase_order_id" UUID,
    "invoice_id" UUID,
    "transfer_group_id" UUID,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "supplier_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL,
    "total_cost_minor" INTEGER NOT NULL,
    "notes" TEXT,
    "ordered_at" TIMESTAMPTZ(3),
    "received_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost_minor" INTEGER NOT NULL,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "incurred_on" DATE NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "supplier_id" UUID,
    "work_order_id" UUID,
    "purchase_order_id" UUID,
    "voided_at" TIMESTAMPTZ(3),
    "void_reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_id_organization_id_key" ON "suppliers"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_organization_id_name_key" ON "suppliers"("organization_id", "name");

-- CreateIndex
CREATE INDEX "equipment_organization_id_branch_id_status_idx" ON "equipment"("organization_id", "branch_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_id_organization_id_key" ON "equipment"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_organization_id_asset_tag_key" ON "equipment"("organization_id", "asset_tag");

-- CreateIndex
CREATE INDEX "maintenance_schedules_organization_id_next_due_on_idx" ON "maintenance_schedules"("organization_id", "next_due_on");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_schedules_id_organization_id_key" ON "maintenance_schedules"("id", "organization_id");

-- CreateIndex
CREATE INDEX "maintenance_work_orders_organization_id_status_idx" ON "maintenance_work_orders"("organization_id", "status");

-- CreateIndex
CREATE INDEX "maintenance_work_orders_organization_id_equipment_id_idx" ON "maintenance_work_orders"("organization_id", "equipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_work_orders_id_organization_id_key" ON "maintenance_work_orders"("id", "organization_id");

-- CreateIndex
CREATE INDEX "equipment_transfers_organization_id_equipment_id_idx" ON "equipment_transfers"("organization_id", "equipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_id_organization_id_key" ON "products"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_sku_key" ON "products"("organization_id", "sku");

-- CreateIndex
CREATE INDEX "stock_movements_organization_id_product_id_created_at_idx" ON "stock_movements"("organization_id", "product_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_organization_id_branch_id_created_at_idx" ON "stock_movements"("organization_id", "branch_id", "created_at");

-- CreateIndex
CREATE INDEX "purchase_orders_organization_id_status_idx" ON "purchase_orders"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_id_organization_id_key" ON "purchase_orders"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_organization_id_number_key" ON "purchase_orders"("organization_id", "number");

-- CreateIndex
CREATE INDEX "expenses_organization_id_branch_id_incurred_on_idx" ON "expenses"("organization_id", "branch_id", "incurred_on");

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_equipment_id_organization_id_fkey" FOREIGN KEY ("equipment_id", "organization_id") REFERENCES "equipment"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_work_orders" ADD CONSTRAINT "maintenance_work_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_work_orders" ADD CONSTRAINT "maintenance_work_orders_equipment_id_organization_id_fkey" FOREIGN KEY ("equipment_id", "organization_id") REFERENCES "equipment"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_work_orders" ADD CONSTRAINT "maintenance_work_orders_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_work_orders" ADD CONSTRAINT "maintenance_work_orders_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "maintenance_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_work_orders" ADD CONSTRAINT "maintenance_work_orders_assigned_to_membership_id_fkey" FOREIGN KEY ("assigned_to_membership_id") REFERENCES "organization_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_transfers" ADD CONSTRAINT "equipment_transfers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_transfers" ADD CONSTRAINT "equipment_transfers_equipment_id_organization_id_fkey" FOREIGN KEY ("equipment_id", "organization_id") REFERENCES "equipment"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_transfers" ADD CONSTRAINT "equipment_transfers_from_branch_id_organization_id_fkey" FOREIGN KEY ("from_branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_transfers" ADD CONSTRAINT "equipment_transfers_to_branch_id_organization_id_fkey" FOREIGN KEY ("to_branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_stock" ADD CONSTRAINT "product_stock_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_stock" ADD CONSTRAINT "product_stock_product_id_organization_id_fkey" FOREIGN KEY ("product_id", "organization_id") REFERENCES "products"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_stock" ADD CONSTRAINT "product_stock_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_organization_id_fkey" FOREIGN KEY ("product_id", "organization_id") REFERENCES "products"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_organization_id_fkey" FOREIGN KEY ("supplier_id", "organization_id") REFERENCES "suppliers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_organization_id_fkey" FOREIGN KEY ("purchase_order_id", "organization_id") REFERENCES "purchase_orders"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_product_id_organization_id_fkey" FOREIGN KEY ("product_id", "organization_id") REFERENCES "products"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branch_id_organization_id_fkey" FOREIGN KEY ("branch_id", "organization_id") REFERENCES "branches"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "maintenance_work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Same-organization guards for optional references
-- ---------------------------------------------------------------------------
CREATE TRIGGER equipment_supplier_same_org BEFORE INSERT OR UPDATE OF supplier_id ON equipment
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('suppliers', 'supplier_id');
CREATE TRIGGER work_orders_schedule_same_org BEFORE INSERT OR UPDATE OF schedule_id ON maintenance_work_orders
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('maintenance_schedules', 'schedule_id');
CREATE TRIGGER work_orders_assignee_same_org BEFORE INSERT OR UPDATE OF assigned_to_membership_id ON maintenance_work_orders
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('organization_memberships', 'assigned_to_membership_id');
CREATE TRIGGER stock_movements_po_same_org BEFORE INSERT OR UPDATE OF purchase_order_id ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('purchase_orders', 'purchase_order_id');
CREATE TRIGGER stock_movements_invoice_same_org BEFORE INSERT OR UPDATE OF invoice_id ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('invoices', 'invoice_id');
CREATE TRIGGER expenses_supplier_same_org BEFORE INSERT OR UPDATE OF supplier_id ON expenses
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('suppliers', 'supplier_id');
CREATE TRIGGER expenses_work_order_same_org BEFORE INSERT OR UPDATE OF work_order_id ON expenses
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('maintenance_work_orders', 'work_order_id');
CREATE TRIGGER expenses_po_same_org BEFORE INSERT OR UPDATE OF purchase_order_id ON expenses
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('purchase_orders', 'purchase_order_id');
CREATE TRIGGER invoice_lines_product_same_org BEFORE INSERT OR UPDATE OF product_id ON invoice_lines
  FOR EACH ROW EXECUTE FUNCTION fg_assert_same_organization('products', 'product_id');

-- ---------------------------------------------------------------------------
-- Integrity checks
-- ---------------------------------------------------------------------------
ALTER TABLE "equipment"
  ADD CONSTRAINT "equipment_cost_check" CHECK ("cost_minor" IS NULL OR "cost_minor" >= 0),
  ADD CONSTRAINT "equipment_retired_check" CHECK ("status" <> 'RETIRED' OR "retired_at" IS NOT NULL);
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_interval_check" CHECK ("interval_days" BETWEEN 1 AND 3650);
ALTER TABLE "maintenance_work_orders"
  ADD CONSTRAINT "work_orders_cost_check" CHECK ("cost_minor" >= 0),
  ADD CONSTRAINT "work_orders_completed_check" CHECK ("status" <> 'COMPLETED' OR "completed_at" IS NOT NULL);
ALTER TABLE "equipment_transfers" ADD CONSTRAINT "equipment_transfers_branches_check" CHECK ("from_branch_id" <> "to_branch_id");
ALTER TABLE "products"
  ADD CONSTRAINT "products_price_check" CHECK ("price_minor" >= 0 AND "cost_minor" >= 0 AND "low_stock_threshold" >= 0),
  ADD CONSTRAINT "products_tax_check" CHECK ("tax_rate_bps" BETWEEN 0 AND 10000);
-- Stock can never go negative: sales and transfers fail instead.
ALTER TABLE "product_stock" ADD CONSTRAINT "product_stock_quantity_check" CHECK ("quantity" >= 0);
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_quantity_check" CHECK ("quantity" <> 0),
  ADD CONSTRAINT "stock_movements_sign_check" CHECK (
    ("type" IN ('RECEIPT', 'RETURN', 'TRANSFER_IN') AND "quantity" > 0)
    OR ("type" IN ('SALE', 'DAMAGE', 'TRANSFER_OUT') AND "quantity" < 0)
    OR "type" = 'ADJUSTMENT'
  );
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "po_lines_check" CHECK ("quantity" > 0 AND "unit_cost_minor" >= 0);
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_total_check" CHECK ("total_cost_minor" >= 0);
ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_amount_check" CHECK ("amount_minor" > 0),
  ADD CONSTRAINT "expenses_void_check" CHECK (("voided_at" IS NULL) = ("void_reason" IS NULL));

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export interface EquipmentDefaults {
  name?: string;
  category?: string;
  branchId?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  cost?: string;
  supplierId?: string;
  warrantyUntil?: string;
  location?: string;
  notes?: string;
}

/** Plain fields (server-rendered) used inside a SimpleForm. */
export function EquipmentFields({
  d,
  branches,
  suppliers,
  currency,
  showBranch,
}: {
  d: EquipmentDefaults;
  branches: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  currency: string;
  showBranch: boolean;
}) {
  const field = (name: keyof EquipmentDefaults, label: string, type = "text") => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`eq-${name}`}>{label}</Label>
      <Input id={`eq-${name}`} name={name} type={type} defaultValue={d[name]} />
    </div>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {field("name", "Name")}
      {field("category", "Category (e.g. Cardio, Strength)")}
      {showBranch ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="eq-branch">Branch</Label>
          <Select id="eq-branch" name="branchId" defaultValue={d.branchId}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <input type="hidden" name="branchId" value={d.branchId} />
      )}
      {field("location", "Location in the gym")}
      {field("brand", "Brand")}
      {field("model", "Model")}
      {field("serialNumber", "Serial number")}
      {field("purchaseDate", "Purchase date", "date")}
      {field("cost", `Cost (${currency})`)}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="eq-supplier">Supplier</Label>
        <Select id="eq-supplier" name="supplierId" defaultValue={d.supplierId ?? ""}>
          <option value="">None</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      {field("warrantyUntil", "Warranty until", "date")}
      {field("notes", "Notes")}
    </div>
  );
}

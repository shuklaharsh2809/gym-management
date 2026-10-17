import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProductFields({
  d,
  currency,
}: {
  d: Record<string, string | boolean>;
  currency: string;
}) {
  const field = (name: string, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`p-${name}`}>{label}</Label>
      <Input id={`p-${name}`} name={name} defaultValue={d[name] as string | undefined} {...props} />
    </div>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {field("name", "Name")}
      {field("sku", "SKU", { className: "uppercase" })}
      {field("category", "Category")}
      {field("barcode", "Barcode")}
      {field("price", `Selling price (${currency})`, { inputMode: "decimal" })}
      {field("cost", `Cost price (${currency})`, { inputMode: "decimal" })}
      {field("taxRatePercent", "Tax rate (%)", { inputMode: "decimal" })}
      {field("lowStockThreshold", "Low-stock alert at", { type: "number", min: 0 })}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="taxInclusive"
          defaultChecked={Boolean(d.taxInclusive)}
          className="size-4"
        />{" "}
        Price includes tax
      </label>
    </div>
  );
}

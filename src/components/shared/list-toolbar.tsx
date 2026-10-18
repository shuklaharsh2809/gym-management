import { Search } from "@/components/icons";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export interface ToolbarFilter {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}

/** GET form: search plus allow-listed filters, reflected in the URL so views are shareable. */
export function ListToolbar({
  q,
  placeholder = "Search",
  filters = [],
  hidden = {},
  extra,
}: {
  q?: string;
  placeholder?: string;
  filters?: ToolbarFilter[];
  hidden?: Record<string, string>;
  extra?: ReactNode;
}) {
  return (
    <form
      method="get"
      className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
      role="search"
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {q !== undefined && (
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={q}
            placeholder={placeholder}
            aria-label={placeholder}
            className="pl-9"
          />
        </div>
      )}
      {filters.map((f) => (
        <label key={f.name} className="flex flex-col gap-1 text-xs text-muted-foreground sm:w-44">
          {f.label}
          <Select name={f.name} defaultValue={f.value} className="text-foreground">
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
      ))}
      {extra}
      <Button type="submit" variant="secondary">
        Apply
      </Button>
    </form>
  );
}

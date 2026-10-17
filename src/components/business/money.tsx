import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function Money({
  minor,
  currency,
  locale,
  className,
}: {
  minor: number;
  currency: string;
  locale: string;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", className)}>{formatMoney(minor, currency, locale)}</span>
  );
}

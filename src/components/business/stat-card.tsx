import type { AppIcon } from "@/components/icons";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  href,
}: {
  icon: AppIcon;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  href?: string;
}) {
  const body = (
    <Card className="h-full p-5 transition-colors hover:border-border-strong">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 text-primary" aria-hidden />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-lg">
      {body}
    </Link>
  ) : (
    body
  );
}

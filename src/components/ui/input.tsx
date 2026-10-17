import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const controlClass =
  "h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 aria-invalid:border-danger";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClass, className)} {...props} />;
}

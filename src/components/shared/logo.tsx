import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="8" fill="var(--fg-emerald-500)" />
      <path
        d="M9 9h14M9 9v14M9 16h9M16 16v7M23 16v7"
        stroke="var(--fg-navy-900)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span
        className={cn(
          "text-lg font-semibold tracking-tight",
          inverted ? "text-white" : "text-brand",
        )}
      >
        FitGrid
      </span>
    </span>
  );
}

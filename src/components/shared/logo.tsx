import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="8" fill="var(--fg-emerald-500)" />
      {/* Dumbbell: two plates on each side of a bar. */}
      <g fill="var(--fg-navy-900)">
        <rect x="5" y="11" width="3" height="10" rx="1.2" />
        <rect x="8.5" y="8.5" width="3.5" height="15" rx="1.5" />
        <rect x="20" y="8.5" width="3.5" height="15" rx="1.5" />
        <rect x="24" y="11" width="3" height="10" rx="1.2" />
        <rect x="12" y="14.5" width="8" height="3" rx="1" />
      </g>
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

import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva("flex gap-3 rounded-md border px-4 py-3 text-sm", {
  variants: {
    tone: {
      info: "border-info/20 bg-info-subtle text-info",
      success: "border-success/20 bg-success-subtle text-success",
      warning: "border-warning/20 bg-warning-subtle text-warning",
      danger: "border-danger/20 bg-danger-subtle text-danger",
    },
  },
  defaultVariants: { tone: "info" },
});

const icons = { info: Info, success: CheckCircle2, warning: TriangleAlert, danger: AlertCircle };

export function Alert({
  className,
  tone = "info",
  children,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  const Icon = icons[tone ?? "info"];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

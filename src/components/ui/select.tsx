import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { controlClass } from "./input";

/** Native select: accessible, form-friendly and fast for long lists such as time zones. */
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(controlClass, "pr-8", className)} {...props} />;
}

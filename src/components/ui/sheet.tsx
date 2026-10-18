"use client";

import { X } from "@/components/icons";
import { Dialog as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Sheet = Primitive.Root;
export const SheetTrigger = Primitive.Trigger;
export const SheetClose = Primitive.Close;
export const SheetTitle = Primitive.Title;

/** Left-side drawer used for mobile navigation. */
export function SheetContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
      <Primitive.Content
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(85vw,var(--fg-sidebar-width))] flex-col shadow-popover outline-none",
          className,
        )}
        {...props}
      >
        {children}
        <Primitive.Close
          className="absolute top-4 right-3 rounded-sm p-1 text-sidebar-muted hover:text-white"
          aria-label="Close navigation"
        >
          <X className="size-5" />
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}

"use client";

import { Menu } from "@/components/icons";
import { useState } from "react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Permission } from "@/server/authorization/permissions";
import { SidebarNav } from "./sidebar-nav";

export function MobileNav({ permissions }: { permissions: Permission[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="bg-brand" aria-describedby={undefined}>
        <div className="flex h-topbar items-center px-5">
          <SheetTitle asChild>
            <div>
              <Logo inverted />
              <span className="sr-only">Navigation</span>
            </div>
          </SheetTitle>
        </div>
        <SidebarNav permissions={permissions} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

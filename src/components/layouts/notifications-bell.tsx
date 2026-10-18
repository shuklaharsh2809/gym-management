"use client";

import { Bell } from "@/components/icons";
import Link from "next/link";
import { useTransition } from "react";
import { markReadAction } from "@/app/(dashboard)/app/settings/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Item {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  when: string;
}

export function NotificationsBell({ items, unread }: { items: Item[]; unread: number }) {
  const [, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative flex size-10 items-center justify-center rounded-full hover:bg-muted"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell className="size-5 text-muted-foreground" aria-hidden />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notifications
          {unread > 0 && (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => start(() => markReadAction(null))}
            >
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 && (
          <p className="px-2.5 py-4 text-sm text-muted-foreground">You&apos;re all caught up.</p>
        )}
        {items.slice(0, 6).map((n) => (
          <DropdownMenuItem
            key={n.id}
            asChild
            onSelect={() => !n.read && start(() => markReadAction(n.id))}
          >
            <Link
              href={n.link ?? "/app/notifications"}
              className="flex flex-col items-start gap-0.5"
            >
              <span className={n.read ? "text-muted-foreground" : "font-medium"}>{n.title}</span>
              <span className="text-xs text-muted-foreground">{n.when}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/notifications">View all</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

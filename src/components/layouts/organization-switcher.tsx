"use client";

import { Building2, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { switchOrganizationAction } from "@/app/(dashboard)/app/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface OrganizationSwitcherProps {
  current: { id: string; name: string };
  options: { id: string; name: string; roleLabel: string }[];
}

export function OrganizationSwitcher({ current, options }: OrganizationSwitcherProps) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-10 max-w-[14rem] items-center gap-2 rounded-md px-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-60"
        disabled={pending}
        aria-label={`Organization: ${current.name}. Switch organization`}
      >
        <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{current.name}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={current.id}
          onValueChange={(id) =>
            startTransition(async () => void (await switchOrganizationAction(id)))
          }
        >
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.id} value={o.id}>
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{o.name}</span>
                <span className="text-xs text-muted-foreground">{o.roleLabel}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding">
            <Plus aria-hidden /> Create organization
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

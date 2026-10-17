"use client";

import { ChevronDown, MapPin } from "lucide-react";
import { useTransition } from "react";
import { switchBranchAction } from "@/app/(dashboard)/app/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ALL = "__all__";

interface BranchSelectorProps {
  branches: { id: string; name: string; code: string }[];
  activeBranchId: string | null;
  allowAllBranches: boolean;
}

export function BranchSelector({
  branches,
  activeBranchId,
  allowAllBranches,
}: BranchSelectorProps) {
  const [pending, startTransition] = useTransition();
  const active = branches.find((b) => b.id === activeBranchId);
  const label = active?.name ?? (allowAllBranches ? "All branches" : "No branch access");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-10 max-w-[13rem] items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm hover:bg-muted disabled:opacity-60"
        disabled={pending || (branches.length === 0 && !allowAllBranches)}
        aria-label={`Branch: ${label}. Change branch`}
      >
        <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="truncate">{label}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Working in</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={activeBranchId ?? ALL}
          onValueChange={(value) =>
            startTransition(
              async () => void (await switchBranchAction(value === ALL ? null : value)),
            )
          }
        >
          {allowAllBranches && (
            <DropdownMenuRadioItem value={ALL}>All branches</DropdownMenuRadioItem>
          )}
          {branches.map((b) => (
            <DropdownMenuRadioItem key={b.id} value={b.id}>
              <span className="truncate">{b.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{b.code}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

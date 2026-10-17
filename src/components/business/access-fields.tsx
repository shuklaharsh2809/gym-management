"use client";

import { useState } from "react";
import { FormField } from "@/components/shared/form-field";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { FieldErrors } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { ASSIGNABLE_ROLES, type AssignableRole } from "@/modules/team/schemas";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/server/authorization/permissions";

interface AccessFieldsProps {
  branches: { id: string; name: string; code: string }[];
  defaults: {
    role: AssignableRole;
    branchScope: "ALL_BRANCHES" | "ASSIGNED_BRANCHES";
    branchIds: string[];
  };
  canGrantAdmin: boolean;
  errors?: FieldErrors;
}

/** Role select + branch access (all branches, or specific branches). */
export function AccessFields({ branches, defaults, canGrantAdmin, errors }: AccessFieldsProps) {
  const [role, setRole] = useState<AssignableRole>(defaults.role);
  const [scope, setScope] = useState(defaults.branchScope);
  const effectiveScope = role === "ADMIN" ? "ALL_BRANCHES" : scope;
  const roles = ASSIGNABLE_ROLES.filter(
    (r) => r !== "ADMIN" || canGrantAdmin || defaults.role === "ADMIN",
  );

  return (
    <>
      <FormField
        id="role"
        label="Role"
        hint={ROLE_DESCRIPTIONS[role]}
        errors={errors?.role}
        required
      >
        <Select
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as AssignableRole)}
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </FormField>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1.5 text-sm font-medium">Branch access</legend>
        {(
          [
            ["ALL_BRANCHES", "All branches", "Includes branches added later."],
            ["ASSIGNED_BRANCHES", "Specific branches", "Only the branches selected below."],
          ] as const
        ).map(([value, label, hint]) => (
          <label
            key={value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-checked:border-primary has-checked:bg-success-subtle/40 has-disabled:cursor-not-allowed has-disabled:opacity-60",
            )}
          >
            <input
              type="radio"
              name="branchScope"
              value={value}
              checked={effectiveScope === value}
              disabled={role === "ADMIN" && value === "ASSIGNED_BRANCHES"}
              onChange={() => setScope(value)}
              className="mt-0.5 size-4 accent-(--fg-emerald-700)"
            />
            <span>
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">
                {role === "ADMIN" && value === "ASSIGNED_BRANCHES"
                  ? "Administrators always have access to all branches."
                  : hint}
              </span>
            </span>
          </label>
        ))}
        {errors?.branchScope && (
          <p className="text-xs font-medium text-danger">{errors.branchScope[0]}</p>
        )}
      </fieldset>

      {effectiveScope === "ASSIGNED_BRANCHES" && (
        <fieldset aria-describedby={errors?.branchIds ? "branchIds-error" : undefined}>
          <legend className="mb-2 text-sm font-medium">Branches</legend>
          {branches.length === 0 ? (
            <p className="text-sm text-muted-foreground">There are no active branches to assign.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {branches.map((b) => (
                <div key={b.id} className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id={`branch-${b.id}`}
                    name="branchIds"
                    value={b.id}
                    defaultChecked={defaults.branchIds.includes(b.id)}
                    className="size-4 accent-(--fg-emerald-700)"
                  />
                  <Label htmlFor={`branch-${b.id}`} className="font-normal">
                    {b.name} <span className="text-xs text-muted-foreground">{b.code}</span>
                  </Label>
                </div>
              ))}
            </div>
          )}
          {errors?.branchIds && (
            <p id="branchIds-error" className="mt-2 text-xs font-medium text-danger">
              {errors.branchIds[0]}
            </p>
          )}
        </fieldset>
      )}
    </>
  );
}

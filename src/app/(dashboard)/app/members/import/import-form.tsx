"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { importMembersAction, type ImportPreviewState } from "../../settings/actions";

export function ImportForm({
  branches,
  defaultBranchId,
}: {
  branches: { id: string; name: string }[];
  defaultBranchId: string;
}) {
  const [state, formAction] = useActionState<ImportPreviewState | null, FormData>(
    importMembersAction,
    null,
  );
  const previewing = state?.ok && state.counts && !state.committed;
  return (
    <div className="flex flex-col gap-4">
      {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
      {state?.committed && <Alert tone="success">{state.message}</Alert>}
      <Card>
        <CardContent className="pt-6">
          <form action={formAction} className="flex flex-col gap-3">
            <div>
              <Label htmlFor="imp-file">CSV file</Label>
              <input
                id="imp-file"
                name="file"
                type="file"
                accept=".csv,text/csv"
                className="mt-1 block text-sm"
              />
            </div>
            <div>
              <Label htmlFor="imp-branch">Home branch for rows without a branch code</Label>
              <Select id="imp-branch" name="branchId" defaultValue={defaultBranchId}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <SubmitButton variant="secondary" pendingLabel="Checking…">
                Preview
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
      {previewing && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <p className="flex flex-wrap gap-2 text-sm">
              <Badge tone="success">{state.counts!.ready} ready</Badge>
              <Badge tone="warning">{state.counts!.duplicate} duplicates (skipped)</Badge>
              <Badge tone="danger">{state.counts!.invalid} invalid (skipped)</Badge>
            </p>
            <ul className="max-h-80 divide-y divide-border overflow-y-auto text-sm">
              {state.rows!.map((r) => (
                <li key={r.line} className="flex items-start justify-between gap-2 py-1.5">
                  <span>
                    Line {r.line}: {r.name}
                    {r.messages.length > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        {r.messages.join("; ")}
                      </span>
                    )}
                  </span>
                  <Badge
                    tone={
                      r.status === "ready"
                        ? "success"
                        : r.status === "duplicate"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {r.status}
                  </Badge>
                </li>
              ))}
            </ul>
            {state.counts!.ready > 0 && (
              <form action={formAction}>
                <input type="hidden" name="intent" value="commit" />
                <input type="hidden" name="csv" value={state.csv} />
                <input type="hidden" name="fileName" value={state.fileName ?? ""} />
                <input type="hidden" name="branchId" value={state.branchId} />
                <SubmitButton pendingLabel="Importing…">
                  Import {state.counts!.ready} member(s)
                </SubmitButton>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

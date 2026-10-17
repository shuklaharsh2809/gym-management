export function formatDateTime(date: Date, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

export function formatDate(date: Date, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(date);
}

const AUDIT_LABELS: Record<string, string> = {
  "organization.created": "Created the organization",
  "organization.updated": "Updated organization settings",
  "branch.created": "Added a branch",
  "branch.updated": "Updated a branch",
  "branch.deactivated": "Deactivated a branch",
  "branch.reactivated": "Reactivated a branch",
  "team.branch_assigned": "Assigned a team member to a branch",
  "team.branch_unassigned": "Removed a team member's branch access",
};

export function describeAuditAction(action: string) {
  return AUDIT_LABELS[action] ?? action;
}

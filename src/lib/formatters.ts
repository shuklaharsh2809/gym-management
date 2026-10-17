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
  "team.member_updated": "Changed a team member's access",
  "team.member_suspended": "Suspended a team member",
  "team.member_reactivated": "Reactivated a team member",
  "team.member_revoked": "Removed a team member",
  "invitation.created": "Invited a team member",
  "invitation.resent": "Sent a new invitation link",
  "invitation.revoked": "Cancelled an invitation",
  "invitation.accepted": "Accepted an invitation",
  "member.created": "Registered a member",
  "member.updated": "Updated a member",
  "member.archived": "Archived a member",
  "member.restored": "Restored a member",
  "member.note_added": "Added a member note",
  "plan.created": "Created a membership plan",
  "plan.updated": "Updated a membership plan",
  "plan.archived": "Archived a membership plan",
  "plan.restored": "Restored a membership plan",
  "membership.created": "Sold a membership",
  "membership.frozen": "Froze a membership",
  "membership.resumed": "Resumed a membership",
  "membership.extended": "Extended a membership",
  "membership.cancelled": "Cancelled a membership",
  "membership.renewed": "Renewed a membership",
  "invoice.created": "Issued an invoice",
  "invoice.voided": "Voided an invoice",
  "payment.recorded": "Recorded a payment",
  "payment.refunded": "Issued a refund",
  "payment.online_started": "Started an online payment",
  "checkin.recorded": "Checked in a member",
  "checkin.denied": "Denied a check-in",
};

export function describeAuditAction(action: string) {
  return AUDIT_LABELS[action] ?? action;
}

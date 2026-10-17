import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { listTimeZones } from "@/lib/markets";
import { getOrganizationProfile } from "@/modules/organizations/service";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { OrganizationProfileForm } from "./organization-profile-form";

export const metadata: Metadata = { title: "Organization" };

export default async function OrganizationPage() {
  const ctx = await requireOrganizationContext();
  const profile = await getOrganizationProfile(db, ctx);
  const canEdit = hasPermission(ctx, "organization.update");

  return (
    <>
      <PageHeader
        title="Organization"
        description={
          canEdit
            ? "Business details and regional defaults used across all branches."
            : "Business details for your organization. Only owners and administrators can change them."
        }
      />
      <OrganizationProfileForm
        profile={{
          name: profile.name,
          legalName: profile.legalName ?? "",
          countryCode: profile.countryCode,
          timezone: profile.timezone,
          currency: profile.currency,
          locale: profile.locale,
        }}
        timeZones={listTimeZones()}
        canEdit={canEdit}
      />
    </>
  );
}

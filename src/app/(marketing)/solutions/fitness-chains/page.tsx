import { BarChart3, Building2, Repeat, ShieldCheck } from "@/components/icons";
import type { Metadata } from "next";
import { FeatureGrid, Hero, Section } from "@/components/shared/marketing";
import { PHOTOS } from "@/lib/imagery";

export const metadata: Metadata = { title: "For fitness chains" };

export default function ChainsPage() {
  return (
    <>
      <Hero
        photo={PHOTOS.clubSkyline}
        eyebrow="Multi-branch chains & franchises"
        title="Run every branch from one source of truth"
        body="Branch teams work locally; leadership sees the whole business with consistent numbers."
      />
      <Section title="Built for scale">
        <FeatureGrid
          items={[
            {
              icon: Building2,
              title: "Branch-scoped access",
              body: "Managers and front desks see only their branches. Owners see everything.",
            },
            {
              icon: Repeat,
              title: "Cross-branch memberships",
              body: "Decide which plans work at which branches, and whether staff can see members from other locations.",
            },
            {
              icon: BarChart3,
              title: "Consolidated reporting",
              body: "Collections, attendance, retention and maintenance by branch, exportable to CSV.",
            },
            {
              icon: ShieldCheck,
              title: "Controls & audit",
              body: "Every sale, refund, access change and export is recorded.",
            },
          ]}
        />
      </Section>
    </>
  );
}

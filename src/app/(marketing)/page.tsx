import {
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  ScanLine,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { FeatureGrid, Hero, Section } from "@/components/shared/marketing";

export default function LandingPage() {
  return (
    <>
      <Hero
        eyebrow="Gym & fitness business management"
        title="Every location. One connected business."
        body="FitGrid brings members, memberships, payments, attendance, staff, classes, equipment and inventory together across all of your branches."
      />
      <Section
        title="Built for how gyms actually run"
        intro="From the front desk to the finance team, everyone works from the same records."
      >
        <FeatureGrid
          items={[
            {
              icon: ScanLine,
              title: "Fast front desk",
              body: "Find a member by name, phone or QR code and check them in. Eligibility is verified instantly.",
            },
            {
              icon: CreditCard,
              title: "Memberships & billing",
              body: "Plans, renewals, freezes, invoices with GST/VAT, partial payments, refunds and online checkout.",
            },
            {
              icon: Building2,
              title: "Multi-branch",
              body: "Branch-level access for staff, consolidated reports for owners, transfers with full history.",
            },
            {
              icon: CalendarDays,
              title: "Classes & PT",
              body: "Recurring schedules, capacity-safe booking, waitlists and session packs.",
            },
            {
              icon: Wrench,
              title: "Equipment & stock",
              body: "Maintenance schedules, work orders, inventory, purchase orders and point of sale.",
            },
            {
              icon: BarChart3,
              title: "Reports that agree",
              body: "Every dashboard card and report uses the same metric definitions.",
            },
          ]}
        />
      </Section>
      <section className="bg-canvas">
        <Section title="Secure by design">
          <FeatureGrid
            items={[
              {
                icon: ShieldCheck,
                title: "Tenant isolation",
                body: "Every request is checked against your organization, branch and role on the server, with database constraints as a second line of defence.",
              },
              {
                icon: Users,
                title: "Least privilege",
                body: "Receptionists, trainers, accountants and technicians see only what their job needs.",
              },
              {
                icon: BarChart3,
                title: "Full audit trail",
                body: "Sales, payments, refunds, access changes and exports are all recorded.",
              },
            ]}
          />
        </Section>
      </section>
    </>
  );
}

import {
  Bell,
  Boxes,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  Plug,
  ScanLine,
  Target,
  Upload,
  Users,
  Wrench,
} from "lucide-react";
import type { Metadata } from "next";
import { FeatureGrid, Hero, Section } from "@/components/shared/marketing";

export const metadata: Metadata = { title: "Features" };

export default function FeaturesPage() {
  return (
    <>
      <Hero
        eyebrow="Features"
        title="Everything a fitness business runs on"
        body="One platform for members, money, schedules, staff and facilities."
      />
      <Section title="Members & memberships">
        <FeatureGrid
          items={[
            {
              icon: Users,
              title: "Member directory",
              body: "Profiles, emergency contacts, health notes with restricted access, tags, waivers and consent documents.",
            },
            {
              icon: CreditCard,
              title: "Plans & lifecycle",
              body: "Monthly to annual plans, day passes, class and PT packs, joining fees, freezes, extensions and renewals with history.",
            },
            {
              icon: Upload,
              title: "CSV import & export",
              body: "Bring members over with a dry-run preview and duplicate detection.",
            },
          ]}
        />
      </Section>
      <Section title="Front desk, sales & billing">
        <FeatureGrid
          items={[
            {
              icon: ScanLine,
              title: "Check-in",
              body: "Server-side eligibility, duplicate protection and clear reasons when entry is denied.",
            },
            {
              icon: FileText,
              title: "Invoices & payments",
              body: "Itemized invoices with tax, partial payments, refunds, receipts and a sandbox online checkout.",
            },
            {
              icon: Target,
              title: "Leads pipeline",
              body: "Track enquiries from walk-in to won, schedule follow-ups and convert without duplicates.",
            },
          ]}
        />
      </Section>
      <Section title="Operations">
        <FeatureGrid
          items={[
            {
              icon: CalendarDays,
              title: "Classes & bookings",
              body: "Recurring classes, rooms, trainer conflict checks, waitlists and attendance.",
            },
            {
              icon: Wrench,
              title: "Equipment maintenance",
              body: "Asset registry, preventive schedules, work orders, downtime and transfers.",
            },
            {
              icon: Boxes,
              title: "Inventory & POS",
              body: "Stock by branch as an auditable ledger, purchase orders and a point of sale.",
            },
            {
              icon: ClipboardList,
              title: "Staff",
              body: "Staff records with protected pay details, shifts and leave approvals.",
            },
            {
              icon: Bell,
              title: "Reminders",
              body: "Daily renewal, maintenance, stock and follow-up reminders.",
            },
            {
              icon: Plug,
              title: "Webhooks",
              body: "Signed events to connect FitGrid with your other systems.",
            },
          ]}
        />
      </Section>
    </>
  );
}

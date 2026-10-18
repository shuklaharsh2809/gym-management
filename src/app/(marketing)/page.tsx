import {
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  ScanLine,
  ShieldCheck,
  Users,
  Wrench,
} from "@/components/icons";
import Link from "next/link";
import { PhotoBackdrop, PhotoCard } from "@/components/business/photo";
import { FeatureGrid, Hero, Section } from "@/components/shared/marketing";
import { Button } from "@/components/ui/button";
import { PHOTOS } from "@/lib/imagery";

export default function LandingPage() {
  return (
    <>
      <Hero
        photo={PHOTOS.clubDark}
        eyebrow="Gym & fitness business management"
        title="Every location. One connected business."
        body="FitGrid brings members, memberships, payments, attendance, staff, classes, equipment and inventory together across all of your branches."
      />
      <Section
        title="From the front door to the squat rack"
        intro="FitGrid follows a member through every part of your gym."
      >
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              photo: PHOTOS.reception,
              title: "Front desk & check-in",
              body: "Members scan in and staff see straight away whether their membership is valid, frozen or expired.",
            },
            {
              photo: PHOTOS.groupClass,
              title: "Classes & coaching",
              body: "Yoga, spin, HIIT and personal training, with live capacity, waitlists and trainer schedules.",
            },
            {
              photo: PHOTOS.rackRow,
              title: "Gym floor & equipment",
              body: "Every treadmill, rack and bike tracked with maintenance schedules and work orders.",
            },
          ].map((f) => (
            <PhotoCard key={f.title} photo={f.photo}>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </PhotoCard>
          ))}
        </div>
      </Section>
      <section className="bg-canvas">
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
      </section>
      <section>
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
      <section className="relative isolate overflow-hidden text-white">
        <PhotoBackdrop photo={PHOTOS.barbellMono} scrim="bg-brand/75" />
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 sm:px-6">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight">
            Spend less time on admin and more time on the gym floor.
          </h2>
          <Button asChild size="lg">
            <Link href="/register">Start your 14-day free trial</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

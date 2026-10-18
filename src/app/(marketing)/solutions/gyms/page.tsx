import { Clock, CreditCard, Smile } from "@/components/icons";
import type { Metadata } from "next";
import { FeatureGrid, Hero, Section } from "@/components/shared/marketing";
import { PHOTOS } from "@/lib/imagery";

export const metadata: Metadata = { title: "For independent gyms" };

export default function GymsPage() {
  return (
    <>
      <Hero
        photo={PHOTOS.trainerTablet}
        eyebrow="Independent gyms & studios"
        title="Spend less time on admin and more on your members"
        body="Set up in an afternoon: add your plans, import members and start checking people in."
      />
      <Section title="What changes on day one">
        <FeatureGrid
          items={[
            {
              icon: Clock,
              title: "A faster front desk",
              body: "Search or scan, see who can enter and why, and sell a membership with the payment in one step.",
            },
            {
              icon: CreditCard,
              title: "No more missed renewals",
              body: "Daily reminders for memberships about to end, and a clear list of who owes what.",
            },
            {
              icon: Smile,
              title: "Staff who know their role",
              body: "Receptionists and trainers get exactly the tools they need, nothing more.",
            },
          ]}
        />
      </Section>
    </>
  );
}

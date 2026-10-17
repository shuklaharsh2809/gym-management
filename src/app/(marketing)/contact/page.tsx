import type { Metadata } from "next";
import { Hero } from "@/components/shared/marketing";
import { Card, CardContent } from "@/components/ui/card";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <>
      <Hero
        eyebrow="Contact"
        title="Let's talk about your gym"
        body="Tell us about your business and we'll show you how FitGrid fits."
        cta={false}
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Card>
          <CardContent className="pt-6">
            <ContactForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

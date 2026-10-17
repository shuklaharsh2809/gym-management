import type { Metadata } from "next";
import { Prose } from "@/components/shared/marketing";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <Prose>
      <h1>Terms of service</h1>
      <p>
        <strong>Draft for review.</strong> These terms are a placeholder for legal review before
        FitGrid is offered commercially.
      </p>
      <h2>The service</h2>
      <p>
        FitGrid provides software for managing fitness businesses. Online payments currently run in
        sandbox mode; no real money is processed through FitGrid.
      </p>
      <h2>Your responsibilities</h2>
      <ul>
        <li>Keep login details secure and give staff only the access they need.</li>
        <li>
          Make sure you have a lawful basis to store your members&apos; data, including health
          information.
        </li>
        <li>Keep invoices and tax settings correct for your market.</li>
      </ul>
      <h2>Plans and trials</h2>
      <p>
        New organizations start with a 14-day trial. Plan limits on branches and members apply as
        shown on the pricing page.
      </p>
      <h2>Data</h2>
      <p>
        You own your data and can export it. Records such as invoices, payments and audit history
        are kept rather than deleted so that history remains accurate.
      </p>
    </Prose>
  );
}

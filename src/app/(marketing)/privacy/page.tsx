import type { Metadata } from "next";
import { Prose } from "@/components/shared/marketing";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <Prose>
      <h1>Privacy notice</h1>
      <p>
        <strong>Draft for review.</strong> This notice describes how the FitGrid software handles
        data. It is not legal advice and must be reviewed by counsel before production use.
      </p>
      <h2>Who controls member data</h2>
      <p>
        Each gym or fitness business (an &quot;organization&quot;) controls the personal data of its
        members and staff. FitGrid processes that data on the organization&apos;s behalf.
      </p>
      <h2>What is stored</h2>
      <ul>
        <li>Account data for staff: name, email, password hash, sessions.</li>
        <li>
          Member data entered by the organization: contact details, memberships, payments,
          attendance, documents and, where recorded, health notes.
        </li>
        <li>Audit records of significant actions, kept for accountability.</li>
      </ul>
      <h2>How it is protected</h2>
      <ul>
        <li>
          Data is separated by organization and checked on every request; staff see only their
          organization and, where configured, their branches.
        </li>
        <li>Health information and staff pay are restricted to authorized roles.</li>
        <li>Passwords are hashed; card details are never stored by FitGrid.</li>
      </ul>
      <h2>Your rights</h2>
      <p>
        Members should contact their gym to access, correct or delete their data. Organizations can
        export member data as CSV.
      </p>
      <h2>Contact</h2>
      <p>Questions about this notice: use the contact page.</p>
    </Prose>
  );
}

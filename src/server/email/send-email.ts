import { logger } from "@/lib/logger";

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Email delivery. Only the "console" transport exists: messages are written to the
 * server log for local development. No email is actually sent.
 */
export async function sendEmail(email: OutgoingEmail): Promise<void> {
  logger.info("email.console_transport", {
    note: "Development transport - email not delivered",
    to: email.to,
    subject: email.subject,
    body: email.text,
  });
}

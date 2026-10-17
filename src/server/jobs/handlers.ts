import { deliverWebhook } from "@/modules/integrations/webhooks";
import { sendEmail } from "@/server/email/send-email";
import { runDailyForOrganization } from "./daily";
import type { JobHandler } from "./runner";

type Payload = Record<string, unknown>;

export const JOB_HANDLERS: Record<string, JobHandler> = {
  "org.daily": async (job, db) => {
    const p = job.payload as Payload;
    await runDailyForOrganization(db, String(p.organizationId), String(p.date));
  },
  "email.send": async (job, db) => {
    const p = job.payload as Payload;
    const delivery = await db.emailDelivery.findUniqueOrThrow({
      where: { id: String(p.deliveryId) },
    });
    if (delivery.status === "SENT") return;
    try {
      await sendEmail({ to: delivery.recipient, subject: delivery.subject, text: String(p.text) });
      await db.emailDelivery.update({
        where: { id: delivery.id },
        data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 } },
      });
    } catch (error) {
      await db.emailDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "FAILED",
          attempts: { increment: 1 },
          lastError: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  },
  "webhook.deliver": async (job, db) => {
    await deliverWebhook(db, String((job.payload as Payload).deliveryId));
  },
};

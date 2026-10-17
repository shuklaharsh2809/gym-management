"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { formDataToObject, parseInput, runAction, type ActionResult } from "@/server/actions";
import { db } from "@/server/database/client";
import { ConflictError } from "@/lib/errors";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  company: z.string().trim().max(120).optional(),
  locations: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number().int().min(1).max(10000).optional(),
  ),
  message: z.string().trim().min(10, "Tell us a bit more").max(4000),
  website: z.string().max(0).optional(), // honeypot: must stay empty
});

export async function submitContactAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  return runAction(
    "contact.submit",
    async () => {
      const input = parseInput(schema, formDataToObject(formData));
      const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      // Store only a keyed hash of the IP, used to limit abuse.
      const ipHash = createHash("sha256")
        .update(`${serverEnv().BETTER_AUTH_SECRET}:${ip}`)
        .digest("hex");
      const recent = await db.contactRequest.count({
        where: { ipHash, createdAt: { gte: new Date(Date.now() - 3600_000) } },
      });
      if (recent >= 5) throw new ConflictError("Too many messages. Please try again later.");
      await db.contactRequest.create({
        data: {
          name: input.name,
          email: input.email,
          company: input.company || null,
          locations: input.locations,
          message: input.message,
          ipHash,
        },
      });
    },
    "Thanks! We'll get back to you within one business day.",
  );
}

import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.url(),
  EMAIL_TRANSPORT: z.enum(["console"]).default("console"),
  /** Shared secret for signing/verifying sandbox payment webhooks. */
  PAYMENTS_SANDBOX_WEBHOOK_SECRET: z
    .string()
    .min(32, "PAYMENTS_SANDBOX_WEBHOOK_SECRET must be at least 32 characters"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/** Validated server environment. Throws a readable error listing every invalid variable. */
export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
  }
  cached = parsed.data;
  return cached;
}

export function parseServerEnv(source: Record<string, string | undefined>) {
  return serverEnvSchema.safeParse(source);
}

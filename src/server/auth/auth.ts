import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { serverEnv } from "@/lib/env";
import { db } from "@/server/database/client";
import { sendEmail } from "@/server/email/send-email";

const env = serverEnv();

export const auth = betterAuth({
  appName: "FitGrid",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 60 * 30,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your FitGrid password",
        text: `Use this link to reset your password. It expires in 30 minutes.\n\n${url}`,
      });
    },
  },
  advanced: {
    database: { generateId: "uuid" },
  },
  // nextCookies must stay last so Server Actions can set auth cookies.
  plugins: [nextCookies()],
});

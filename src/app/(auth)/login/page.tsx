import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/redirects";
import { getSessionUser } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; next?: string; email?: string }>;
}) {
  const { reset, next, email } = await searchParams;
  const nextPath = safeNextPath(next, "/app");
  if (await getSessionUser()) redirect(nextPath);
  return <LoginForm passwordReset={reset === "1"} next={nextPath} email={email ?? ""} />;
}

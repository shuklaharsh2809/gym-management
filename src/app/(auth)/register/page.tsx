import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/redirects";
import { getSessionUser } from "@/server/auth/session";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string }>;
}) {
  const { next, email } = await searchParams;
  if (await getSessionUser()) redirect(safeNextPath(next, "/app"));
  return <RegisterForm next={safeNextPath(next, "/onboarding")} email={email ?? ""} />;
}

import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/shared/logo";
import { getSessionUser } from "@/server/auth/session";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  if (await getSessionUser()) redirect("/app");
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="hidden flex-col justify-between bg-brand p-10 text-white lg:flex">
        <Logo inverted />
        <div>
          <p className="text-3xl font-semibold tracking-tight">
            Every location.
            <br />
            One connected business.
          </p>
          <p className="mt-4 max-w-sm text-sidebar-muted">
            Members, memberships, payments and staff across every branch, in one secure workspace.
          </p>
        </div>
        <p className="text-sm text-sidebar-muted">© FitGrid</p>
      </aside>
      <main className="flex flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="mb-8 lg:hidden">
          <Logo />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

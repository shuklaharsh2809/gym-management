import type { ReactNode } from "react";
import { PhotoBackdrop } from "@/components/business/photo";
import { Logo } from "@/components/shared/logo";
import { PHOTOS } from "@/lib/imagery";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative isolate hidden flex-col justify-between overflow-hidden bg-brand p-10 text-white lg:flex">
        <PhotoBackdrop
          photo={PHOTOS.squat}
          priority
          sizes="42vw"
          scrim="bg-gradient-to-t from-brand via-brand/70 to-brand/20"
        />
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

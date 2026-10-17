import { Building2, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

const pillars = [
  {
    icon: Building2,
    title: "Organization-first",
    body: "Run one studio or many branches from a single, consistent workspace.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by design",
    body: "Every request is checked against your organization, branch and role on the server.",
  },
  {
    icon: Users,
    title: "Built for the front desk",
    body: "Fast, clear workflows for the people who keep your gym running.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2" aria-label="Account">
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </nav>
      </header>
      <main>
        <section className="bg-brand text-white">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <p className="text-sm font-medium tracking-wide text-accent uppercase">
              Gym &amp; fitness business management
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Every location. One connected business.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-sidebar-foreground">
              FitGrid brings members, memberships, payments, attendance, staff and equipment
              together across all of your branches.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/register">Create your organization</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-white hover:bg-brand-hover">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
        <section className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:grid-cols-3 sm:px-6">
          {pillars.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <Icon className="size-6 text-primary" aria-hidden />
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        FitGrid is in early development. Features are being released in stages.
      </footer>
    </div>
  );
}

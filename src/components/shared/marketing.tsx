import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PhotoBackdrop } from "@/components/business/photo";
import { Button } from "@/components/ui/button";
import type { Photo } from "@/lib/imagery";

export function Hero({
  eyebrow,
  title,
  body,
  cta = true,
  photo,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cta?: boolean;
  photo?: Photo;
}) {
  return (
    <section className="relative isolate bg-brand text-white">
      {photo && <PhotoBackdrop photo={photo} priority />}
      <div
        className={`mx-auto max-w-6xl px-4 sm:px-6 ${photo ? "py-20 sm:py-32" : "py-16 sm:py-24"}`}
      >
        <p className="text-sm font-medium tracking-wide text-accent uppercase">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-sidebar-foreground">{body}</p>
        {cta && (
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/register">Start free trial</Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-white hover:bg-brand-hover">
              <Link href="/contact">Talk to us</Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export function FeatureGrid({
  items,
}: {
  items: { icon: LucideIcon; title: string; body: ReactNode }[];
}) {
  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ icon: Icon, title, body }) => (
        <div key={title}>
          <div className="flex size-10 items-center justify-center rounded-md bg-success-subtle">
            <Icon className="size-5 text-primary" aria-hidden />
          </div>
          <h3 className="mt-3 font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </div>
      ))}
    </div>
  );
}

export function Section({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {intro && <p className="mt-2 max-w-2xl text-muted-foreground">{intro}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-sm leading-7 sm:px-6 [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-3 [&_p]:text-muted-foreground [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted-foreground">
      {children}
    </div>
  );
}

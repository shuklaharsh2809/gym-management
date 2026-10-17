"use client";

import { MapPin } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { venuePhoto } from "@/lib/imagery";
import { switchBranchAction } from "../actions";

/** Large, photo-led branch choice for front desk staff who haven't picked a location yet. */
export function BranchPicker({
  branches,
}: {
  branches: { id: string; name: string; city: string | null }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (branches.length === 0) {
    return <Alert tone="info">There are no active branches you can work at.</Alert>;
  }
  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {branches.map((b, i) => (
          <li key={b.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await switchBranchAction(b.id);
                  setError(result.ok ? null : result.message);
                })
              }
              className="group relative isolate flex aspect-[16/9] w-full items-end overflow-hidden rounded-lg text-left text-white shadow-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-70"
            >
              <Image
                src={venuePhoto(i).src}
                alt=""
                fill
                placeholder="blur"
                sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="-z-10 object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute inset-0 -z-10 bg-gradient-to-t from-brand via-brand/50 to-transparent" />
              <span className="p-4">
                <span className="block text-lg font-semibold">{b.name}</span>
                {b.city && (
                  <span className="flex items-center gap-1 text-sm text-sidebar-foreground">
                    <MapPin className="size-3.5" aria-hidden /> {b.city}
                  </span>
                )}
                <span className="sr-only">Start front desk at {b.name}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

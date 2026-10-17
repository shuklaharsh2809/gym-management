import Image from "next/image";
import type { ReactNode } from "react";
import type { Photo } from "@/lib/imagery";
import { cn } from "@/lib/utils";

/** A photo filling its container with a navy scrim so overlaid white text stays readable. */
export function PhotoBackdrop({
  photo,
  priority,
  sizes = "100vw",
  className,
  scrim = "bg-gradient-to-r from-brand via-brand/85 to-brand/30",
}: {
  photo: Photo;
  priority?: boolean;
  sizes?: string;
  className?: string;
  scrim?: string;
}) {
  return (
    <div aria-hidden className={cn("absolute inset-0 -z-10 overflow-hidden", className)}>
      <Image
        src={photo.src}
        alt=""
        fill
        priority={priority}
        placeholder="blur"
        sizes={sizes}
        className="object-cover"
      />
      <div className={cn("absolute inset-0", scrim)} />
    </div>
  );
}

/** Rounded, cropped thumbnail for list rows and cards. */
export function PhotoThumb({ photo, className }: { photo: Photo; className?: string }) {
  return (
    <span className={cn("relative block shrink-0 overflow-hidden rounded-md bg-muted", className)}>
      <Image src={photo.src} alt="" fill sizes="96px" className="object-cover" />
    </span>
  );
}

/** Card with a photo header, used for feature highlights and venue pickers. */
export function PhotoCard({
  photo,
  children,
  className,
  sizes = "(min-width: 1024px) 33vw, 100vw",
}: {
  photo: Photo;
  children: ReactNode;
  className?: string;
  sizes?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-surface shadow-card",
        className,
      )}
    >
      <div className="relative aspect-[16/9]">
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          placeholder="blur"
          sizes={sizes}
          className="object-cover"
        />
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

const AVATAR_TONES = [
  "bg-emerald-100 text-emerald-800",
  "bg-sky-100 text-sky-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
  "bg-violet-100 text-violet-800",
  "bg-teal-100 text-teal-800",
];

/** Initials avatar with a colour that stays stable per person. */
export function InitialsAvatar({
  firstName,
  lastName,
  seed,
  className,
}: {
  firstName: string;
  lastName: string;
  seed: string;
  className?: string;
}) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length],
        className,
      )}
    >
      {(firstName[0] ?? "").toUpperCase()}
      {(lastName[0] ?? "").toUpperCase()}
    </span>
  );
}

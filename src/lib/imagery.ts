import type { StaticImageData } from "next/image";
import barbellMono from "@/assets/images/barbell-mono.jpg";
import clubDark from "@/assets/images/club-dark.jpg";
import clubSkyline from "@/assets/images/club-skyline.jpg";
import clubTimber from "@/assets/images/club-timber.jpg";
import coaching from "@/assets/images/coaching.jpg";
import coreMono from "@/assets/images/core-mono.jpg";
import deadlift from "@/assets/images/deadlift.jpg";
import dumbbellGrip from "@/assets/images/dumbbell-grip.jpg";
import dumbbellsTeal from "@/assets/images/dumbbells-teal.jpg";
import floorWide from "@/assets/images/floor-wide.jpg";
import groupClass from "@/assets/images/group-class.jpg";
import rackRow from "@/assets/images/rack-row.jpg";
import reception from "@/assets/images/reception.jpg";
import spinBikes from "@/assets/images/spin-bikes.jpg";
import trainerTablet from "@/assets/images/trainer-tablet.jpg";
import yogaGroup from "@/assets/images/yoga-group.jpg";

/**
 * Curated photography (Unsplash License: free for commercial use, no attribution required; no
 * Unsplash+ images). See src/assets/images/CREDITS.md. Images are bundled and served from our own
 * origin so the CSP keeps `img-src 'self'`.
 */
export interface Photo {
  src: StaticImageData;
  alt: string;
}

export const PHOTOS = {
  clubDark: { src: clubDark, alt: "Dark, premium gym floor with strip lighting" },
  clubSkyline: { src: clubSkyline, alt: "Gym with floor-to-ceiling windows over the city" },
  clubTimber: { src: clubTimber, alt: "Boutique gym with timber ceiling and treadmills" },
  floorWide: { src: floorWide, alt: "Wide view of a strength and cardio floor" },
  rackRow: { src: rackRow, alt: "Row of squat racks and plates" },
  dumbbellsTeal: { src: dumbbellsTeal, alt: "Close-up of a dumbbell rack" },
  reception: { src: reception, alt: "Minimal gym reception desk" },
  coaching: { src: coaching, alt: "Coach guiding a member through a lift" },
  trainerTablet: { src: trainerTablet, alt: "Trainer reviewing a plan with a member on a tablet" },
  groupClass: { src: groupClass, alt: "Group class training with resistance bands" },
  barbellMono: { src: barbellMono, alt: "Black and white shot of an athlete with a barbell" },
  deadlift: { src: deadlift, alt: "Athlete gripping a loaded barbell" },
  yogaGroup: { src: yogaGroup, alt: "Group stretching in a yoga studio" },
  spinBikes: { src: spinBikes, alt: "Row of spin bikes in a cycling studio" },
  coreMono: { src: coreMono, alt: "Black and white shot of a mat workout" },
  dumbbellGrip: { src: dumbbellGrip, alt: "Hand lifting a dumbbell from the rack" },
} satisfies Record<string, Photo>;

const CLASS_KEYWORDS: [RegExp, Photo][] = [
  [/yoga|stretch|mobility|barre/i, PHOTOS.yogaGroup],
  [/pilates|core|abs/i, PHOTOS.coreMono],
  [/spin|cycl|bike|ride/i, PHOTOS.spinBikes],
  [/hiit|circuit|boot|cross|functional|group|bands?/i, PHOTOS.groupClass],
  [/strength|lift|power|barbell|weights?/i, PHOTOS.deadlift],
  [/personal|pt\b|coach/i, PHOTOS.trainerTablet],
  [/box|kick|martial|mma/i, PHOTOS.dumbbellGrip],
];

/** A representative photo for a class type, chosen from its name. */
export function classPhoto(name: string): Photo {
  return CLASS_KEYWORDS.find(([re]) => re.test(name))?.[1] ?? PHOTOS.dumbbellsTeal;
}

const VENUE_PHOTOS = [PHOTOS.clubDark, PHOTOS.clubSkyline, PHOTOS.clubTimber, PHOTOS.floorWide];

/** Cover photo for the nth venue in a list, so neighbouring cards never repeat a picture. */
export function venuePhoto(index: number): Photo {
  return VENUE_PHOTOS[index % VENUE_PHOTOS.length]!;
}

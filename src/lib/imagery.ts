import type { StaticImageData } from "next/image";
import battleRopes from "@/assets/images/battle-ropes.jpg";
import cardioFloor from "@/assets/images/cardio-floor.jpg";
import core from "@/assets/images/core.jpg";
import deadliftDark from "@/assets/images/deadlift-dark.jpg";
import deadlift from "@/assets/images/deadlift.jpg";
import dumbbellGrip from "@/assets/images/dumbbell-grip.jpg";
import dumbbells from "@/assets/images/dumbbells.jpg";
import gymFloor from "@/assets/images/gym-floor.jpg";
import gymInterior from "@/assets/images/gym-interior.jpg";
import squat from "@/assets/images/squat.jpg";
import strength from "@/assets/images/strength.jpg";
import studio from "@/assets/images/studio.jpg";
import yogaClass from "@/assets/images/yoga-class.jpg";

/**
 * Stock photography (Unsplash License, see src/assets/images/CREDITS.md). Images are bundled
 * and served from our own origin so the CSP keeps `img-src 'self'`.
 */
export interface Photo {
  src: StaticImageData;
  alt: string;
}

export const PHOTOS = {
  gymFloor: { src: gymFloor, alt: "Rows of dumbbells on a gym floor" },
  gymInterior: { src: gymInterior, alt: "Gym interior with treadmills" },
  deadlift: { src: deadlift, alt: "Athlete lifting a loaded barbell" },
  deadliftDark: { src: deadliftDark, alt: "Athlete deadlifting under a spotlight" },
  yogaClass: { src: yogaClass, alt: "Group fitness class on mats" },
  studio: { src: studio, alt: "Bright gym with spin bikes and racks" },
  cardioFloor: { src: cardioFloor, alt: "Cardio and strength floor" },
  dumbbells: { src: dumbbells, alt: "Dumbbell rack" },
  strength: { src: strength, alt: "Athlete doing barbell curls" },
  dumbbellGrip: { src: dumbbellGrip, alt: "Hand gripping a dumbbell" },
  battleRopes: { src: battleRopes, alt: "Athlete training with battle ropes" },
  core: { src: core, alt: "Woman doing a core workout" },
  squat: { src: squat, alt: "Athlete with a barbell on her shoulders" },
} satisfies Record<string, Photo>;

const CLASS_KEYWORDS: [RegExp, Photo][] = [
  [/yoga|pilates|stretch|mobility|barre/i, PHOTOS.yogaClass],
  [/spin|cycl|bike|cardio|run/i, PHOTOS.studio],
  [/hiit|circuit|boot|cross|functional|rope/i, PHOTOS.battleRopes],
  [/strength|lift|power|barbell|weights?/i, PHOTOS.deadlift],
  [/core|abs/i, PHOTOS.core],
  [/box|kick|martial|mma/i, PHOTOS.strength],
];

/** A representative photo for a class type, chosen from its name. */
export function classPhoto(name: string): Photo {
  return CLASS_KEYWORDS.find(([re]) => re.test(name))?.[1] ?? PHOTOS.dumbbells;
}

const VENUE_PHOTOS = [PHOTOS.cardioFloor, PHOTOS.studio, PHOTOS.gymFloor, PHOTOS.gymInterior];

/** Cover photo for the nth venue in a list, so neighbouring cards never repeat a picture. */
export function venuePhoto(index: number): Photo {
  return VENUE_PHOTOS[index % VENUE_PHOTOS.length]!;
}

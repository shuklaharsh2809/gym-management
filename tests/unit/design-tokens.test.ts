import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../src/styles/tokens.css", import.meta.url), "utf8");
const tokens = Object.fromEntries(
  [...css.matchAll(/--(fg-[\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]),
);

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(fg: string, bg: string) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a! + 0.05) / (b! + 0.05);
}

const WHITE = "#ffffff";
const t = (name: string) => {
  const value = tokens[name];
  if (!value) throw new Error(`missing token --${name}`);
  return value;
};

// [foreground, background, minimum ratio, usage]
const pairs: [string, string, number, string][] = [
  [t("fg-text"), t("fg-canvas"), 4.5, "body text on canvas"],
  [t("fg-text-muted"), t("fg-surface"), 4.5, "secondary text on cards"],
  [t("fg-text-muted"), t("fg-canvas"), 4.5, "secondary text on canvas"],
  [WHITE, t("fg-emerald-700"), 4.5, "primary button label"],
  [WHITE, t("fg-emerald-800"), 4.5, "primary button hover label"],
  [WHITE, t("fg-navy-900"), 4.5, "brand surface text"],
  [t("fg-sidebar-text"), t("fg-navy-900"), 4.5, "sidebar item"],
  [t("fg-sidebar-text-muted"), t("fg-navy-900"), 4.5, "sidebar secondary text"],
  [t("fg-sidebar-text"), t("fg-navy-700"), 4.5, "active sidebar item"],
  [t("fg-success"), t("fg-success-subtle"), 4.5, "success badge"],
  [t("fg-warning"), t("fg-warning-subtle"), 4.5, "warning badge"],
  [t("fg-danger"), t("fg-danger-subtle"), 4.5, "danger badge"],
  [t("fg-info"), t("fg-info-subtle"), 4.5, "info badge"],
  [WHITE, t("fg-danger"), 4.5, "destructive button label"],
  [t("fg-emerald-700"), t("fg-surface"), 3, "focus ring against surface (non-text)"],
  [t("fg-emerald-500"), t("fg-navy-900"), 3, "accent indicator on sidebar (non-text)"],
];

describe("design token contrast (WCAG 2.2)", () => {
  it.each(pairs)("%s on %s ≥ %d:1 (%s)", (fg, bg, min) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  it("documents that the brand emerald is not usable for white button text", () => {
    expect(contrast(WHITE, t("fg-emerald-500"))).toBeLessThan(4.5);
  });
});

import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env";
import { ValidationError } from "@/lib/errors";
import { suggestBranchCode } from "@/modules/branches/codes";
import { branchInputSchema } from "@/modules/branches/schemas";
import { onboardingSchema } from "@/modules/organizations/schemas";
import { parseInput } from "@/server/actions";

const onboarding = {
  name: "Iron Temple",
  countryCode: "IN",
  timezone: "Asia/Kolkata",
  currency: "INR",
  locale: "en-IN",
  branchName: "Bandra",
};

describe("onboarding input", () => {
  it("accepts valid input and normalises optional fields", () => {
    const parsed = parseInput(onboardingSchema, { ...onboarding, legalName: "  ", branchCode: "" });
    expect(parsed.legalName).toBeUndefined();
    expect(parsed.branchCode).toBeUndefined();
  });

  it("rejects unknown time zones, currencies and unsupported countries", () => {
    try {
      parseInput(onboardingSchema, {
        ...onboarding,
        timezone: "Mars/Olympus",
        currency: "XYZ",
        countryCode: "ZZ",
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const fields = Object.keys((error as ValidationError).fieldErrors).sort();
      expect(fields).toEqual(["countryCode", "currency", "timezone"]);
    }
  });

  it("strips fields the client should not control", () => {
    const parsed = parseInput(onboardingSchema, {
      ...onboarding,
      organizationId: "x",
      role: "ADMIN",
    });
    expect(parsed).not.toHaveProperty("organizationId");
    expect(parsed).not.toHaveProperty("role");
  });
});

describe("branch input", () => {
  it("upper-cases codes and rejects malformed ones", () => {
    const base = { name: "Main", timezone: "UTC", countryCode: "GB" };
    expect(parseInput(branchInputSchema, { ...base, code: "ldn-1" }).code).toBe("LDN-1");
    expect(() => parseInput(branchInputSchema, { ...base, code: "has space" })).toThrow(
      ValidationError,
    );
    expect(() => parseInput(branchInputSchema, { ...base, email: "nope" })).toThrow(
      ValidationError,
    );
  });
});

describe("branch code suggestion", () => {
  it("derives a prefix and skips taken codes", () => {
    expect(suggestBranchCode("Andheri West", [])).toBe("AND-01");
    expect(suggestBranchCode("Andheri East", ["AND-01", "and-02"])).toBe("AND-03");
    expect(suggestBranchCode("!!!", [])).toBe("BR-01");
  });
});

describe("environment validation", () => {
  const valid = {
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    BETTER_AUTH_SECRET: "x".repeat(32),
    BETTER_AUTH_URL: "http://localhost:3000",
    PAYMENTS_SANDBOX_WEBHOOK_SECRET: "y".repeat(32),
  };

  it("accepts a complete configuration", () => {
    expect(parseServerEnv(valid).success).toBe(true);
  });

  it("rejects short secrets and non-postgres URLs", () => {
    expect(parseServerEnv({ ...valid, BETTER_AUTH_SECRET: "short" }).success).toBe(false);
    expect(parseServerEnv({ ...valid, DATABASE_URL: "mysql://localhost/db" }).success).toBe(false);
  });
});

describe("time zone options", () => {
  it("always offers every supported market's default time zone", async () => {
    const { listTimeZones, MARKETS } = await import("@/lib/markets");
    const zones = listTimeZones();
    for (const m of MARKETS) expect(zones, m.timezone).toContain(m.timezone);
  });
});

describe("post-login redirect", () => {
  it("allows only same-origin relative paths", async () => {
    const { safeNextPath } = await import("@/lib/redirects");
    expect(safeNextPath("/invite/abc", "/app")).toBe("/invite/abc");
    expect(safeNextPath("/app?x=1", "/app")).toBe("/app?x=1");
    for (const bad of [
      "//evil.example",
      "https://evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "",
      null,
    ]) {
      expect(safeNextPath(bad, "/app"), String(bad)).toBe("/app");
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  dayBounds,
  daysBetween,
  isDateOnly,
  localDate,
  localTime,
  zonedDateTime,
} from "@/lib/dates";
import {
  computeLine,
  currencyDigits,
  divRound,
  formatMoney,
  parseMoney,
  sumLines,
  toDecimalString,
} from "@/lib/money";
import { parseListParams } from "@/lib/pagination";

describe("money", () => {
  it("knows currency precision", () => {
    expect(currencyDigits("INR")).toBe(2);
    expect(currencyDigits("JPY")).toBe(0);
    expect(currencyDigits("BHD")).toBe(3);
  });

  it("parses decimal strings exactly", () => {
    expect(parseMoney("1,499.50", "INR")).toBe(149950);
    expect(parseMoney("0.1", "USD")).toBe(10);
    expect(parseMoney("1000", "JPY")).toBe(1000);
    expect(parseMoney("10.5", "JPY")).toBeNull();
    expect(parseMoney("1.234", "INR")).toBeNull();
    expect(parseMoney("-5", "INR")).toBeNull();
    expect(parseMoney("abc", "INR")).toBeNull();
    expect(parseMoney("1.005", "BHD")).toBe(1005);
  });

  it("round-trips to decimal strings and formats", () => {
    expect(toDecimalString(149950, "INR")).toBe("1499.50");
    expect(toDecimalString(-5, "USD")).toBe("-0.05");
    expect(toDecimalString(1000, "JPY")).toBe("1000");
    expect(formatMoney(149950, "INR", "en-IN")).toBe("₹1,499.50");
  });

  it("rounds half away from zero", () => {
    expect(divRound(5, 2)).toBe(3);
    expect(divRound(-5, 2)).toBe(-3);
    expect(divRound(4, 3)).toBe(1);
  });

  it("computes exclusive and inclusive tax without drift", () => {
    expect(
      computeLine({ unitPriceMinor: 100000, quantity: 1, taxRateBps: 1800, taxInclusive: false }),
    ).toEqual({
      netMinor: 100000,
      taxMinor: 18000,
      totalMinor: 118000,
    });
    const inclusive = computeLine({
      unitPriceMinor: 118000,
      quantity: 1,
      taxRateBps: 1800,
      taxInclusive: true,
    });
    expect(inclusive).toEqual({ netMinor: 100000, taxMinor: 18000, totalMinor: 118000 });
    const odd = computeLine({
      unitPriceMinor: 99999,
      quantity: 3,
      discountMinor: 1,
      taxRateBps: 500,
      taxInclusive: true,
    });
    expect(odd.netMinor + odd.taxMinor).toBe(odd.totalMinor);
    expect(odd.totalMinor).toBe(299996);
    expect(() =>
      computeLine({
        unitPriceMinor: 10,
        quantity: 1,
        discountMinor: 11,
        taxRateBps: 0,
        taxInclusive: false,
      }),
    ).toThrow();
    expect(sumLines([inclusive, inclusive]).totalMinor).toBe(236000);
  });
});

describe("dates", () => {
  it("validates date-only strings", () => {
    expect(isDateOnly("2026-02-28")).toBe(true);
    expect(isDateOnly("2026-02-30")).toBe(false);
    expect(isDateOnly("26-1-1")).toBe(false);
  });

  it("adds days and months with end-of-month clamping", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-01-01", "2026-03-01")).toBe(59);
  });

  it("computes the local business day for a branch", () => {
    const instant = new Date("2026-10-17T20:00:00Z");
    expect(localDate(instant, "Asia/Kolkata")).toBe("2026-10-18");
    expect(localDate(instant, "America/New_York")).toBe("2026-10-17");
  });

  it("bounds local days across daylight-saving transitions", () => {
    const spring = dayBounds("2026-03-29", "Europe/London"); // clocks go forward: 23h day
    expect(spring.start.toISOString()).toBe("2026-03-29T00:00:00.000Z");
    expect(spring.end.getTime() - spring.start.getTime()).toBe(23 * 3600_000);
    const autumn = dayBounds("2026-10-25", "Europe/London"); // clocks go back: 25h day
    expect(autumn.start.toISOString()).toBe("2026-10-24T23:00:00.000Z");
    expect(autumn.end.getTime() - autumn.start.getTime()).toBe(25 * 3600_000);
    const india = dayBounds("2026-10-17", "Asia/Kolkata");
    expect(india.start.toISOString()).toBe("2026-10-16T18:30:00.000Z");
  });
});

describe("zoned wall-clock times", () => {
  it("converts local times to instants, including on DST days", () => {
    expect(zonedDateTime("2026-10-17", "06:30", "Asia/Kolkata").toISOString()).toBe(
      "2026-10-17T01:00:00.000Z",
    );
    expect(zonedDateTime("2026-03-29", "09:00", "Europe/London").toISOString()).toBe(
      "2026-03-29T08:00:00.000Z",
    );
    expect(zonedDateTime("2026-03-28", "09:00", "Europe/London").toISOString()).toBe(
      "2026-03-28T09:00:00.000Z",
    );
    expect(zonedDateTime("2026-10-25", "18:00", "Europe/London").toISOString()).toBe(
      "2026-10-25T18:00:00.000Z",
    );
    expect(zonedDateTime("2026-03-08", "10:00", "America/New_York").toISOString()).toBe(
      "2026-03-08T14:00:00.000Z",
    );
    expect(localTime(new Date("2026-10-17T01:00:00Z"), "Asia/Kolkata")).toBe("06:30");
  });
});

describe("list params", () => {
  it("allow-lists sort fields and clamps paging", () => {
    const p = parseListParams(
      { page: "-3", sort: "password", dir: "sideways", q: "  ana " },
      {
        sorts: ["name", "createdAt"] as const,
        defaultSort: "name",
      },
    );
    expect(p).toEqual({ page: 1, pageSize: 25, q: "ana", sort: "name", dir: "asc" });
  });
});

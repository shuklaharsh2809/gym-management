import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvObjects, toCsv } from "@/lib/csv";

describe("csv", () => {
  it("parses quotes, escaped quotes, commas and newlines", () => {
    expect(parseCsv('a,b\r\n"x, y","he said ""hi"""\n"multi\nline",z\n')).toEqual([
      ["a", "b"],
      ["x, y", 'he said "hi"'],
      ["multi\nline", "z"],
    ]);
  });

  it("maps headers to keys and skips blank lines", () => {
    expect(parseCsvObjects("﻿First Name,Phone\nAsha,123\n\n")).toEqual({
      headers: ["first_name", "phone"],
      rows: [{ first_name: "Asha", phone: "123" }],
    });
  });

  it("round-trips and neutralizes formula injection", () => {
    const csv = toCsv(
      ["name", "note"],
      [
        ["Asha", '=HYPERLINK("x")'],
        ["B, C", "line\nbreak"],
      ],
    );
    expect(csv).toBe('name,note\r\nAsha,"\'=HYPERLINK(""x"")"\r\n"B, C","line\nbreak"\r\n');
    expect(parseCsv(csv)[1]).toEqual(["Asha", `'=HYPERLINK("x")`]);
  });
});

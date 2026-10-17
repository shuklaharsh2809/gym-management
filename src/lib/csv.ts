/** Minimal RFC 4180 CSV parser and writer (quotes, escaped quotes, CRLF, embedded newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** Parse with a header row into objects keyed by normalized header names. */
export function parseCsvObjects(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const [header, ...body] = parseCsv(text);
  if (!header) return { headers: [], rows: [] };
  const headers = header.map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, ""),
  );
  return {
    headers,
    rows: body.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()]))),
  };
}

function escape(value: unknown): string {
  const s = value == null ? "" : String(value);
  // Neutralize spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(escape).join(",")).join("\r\n") + "\r\n";
}

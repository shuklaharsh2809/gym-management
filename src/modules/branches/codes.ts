/** Suggest a short, unique, human-friendly branch code such as "AND-01". */
export function suggestBranchCode(name: string, existingCodes: Iterable<string>): string {
  const taken = new Set([...existingCodes].map((c) => c.toUpperCase()));
  const letters = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const prefix = (letters.slice(0, 3) || "BR").padEnd(2, "X");
  for (let n = 1; n < 1000; n++) {
    const code = `${prefix}-${String(n).padStart(2, "0")}`;
    if (!taken.has(code)) return code;
  }
  return `${prefix}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

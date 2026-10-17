/**
 * Markets FitGrid currently supports at onboarding, with sensible regional defaults.
 * Adding a market is a product decision (tax, payment methods, compliance), so the
 * list is deliberately curated rather than every ISO country.
 */
export interface Market {
  countryCode: string;
  name: string;
  timezone: string;
  currency: string;
  locale: string;
}

export const MARKETS: readonly Market[] = [
  { countryCode: "IN", name: "India", timezone: "Asia/Kolkata", currency: "INR", locale: "en-IN" },
  {
    countryCode: "AE",
    name: "United Arab Emirates",
    timezone: "Asia/Dubai",
    currency: "AED",
    locale: "en-AE",
  },
  {
    countryCode: "AU",
    name: "Australia",
    timezone: "Australia/Sydney",
    currency: "AUD",
    locale: "en-AU",
  },
  {
    countryCode: "CA",
    name: "Canada",
    timezone: "America/Toronto",
    currency: "CAD",
    locale: "en-CA",
  },
  {
    countryCode: "DE",
    name: "Germany",
    timezone: "Europe/Berlin",
    currency: "EUR",
    locale: "de-DE",
  },
  {
    countryCode: "GB",
    name: "United Kingdom",
    timezone: "Europe/London",
    currency: "GBP",
    locale: "en-GB",
  },
  {
    countryCode: "NZ",
    name: "New Zealand",
    timezone: "Pacific/Auckland",
    currency: "NZD",
    locale: "en-NZ",
  },
  {
    countryCode: "SG",
    name: "Singapore",
    timezone: "Asia/Singapore",
    currency: "SGD",
    locale: "en-SG",
  },
  {
    countryCode: "US",
    name: "United States",
    timezone: "America/New_York",
    currency: "USD",
    locale: "en-US",
  },
  {
    countryCode: "ZA",
    name: "South Africa",
    timezone: "Africa/Johannesburg",
    currency: "ZAR",
    locale: "en-ZA",
  },
];

export const MARKET_CODES = MARKETS.map((m) => m.countryCode);

export function findMarket(countryCode: string): Market | undefined {
  return MARKETS.find((m) => m.countryCode === countryCode);
}

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function isValidCurrency(value: string): boolean {
  return /^[A-Z]{3}$/.test(value) && Intl.supportedValuesOf("currency").includes(value);
}

export function isValidLocale(value: string): boolean {
  try {
    return Intl.getCanonicalLocales(value).length === 1;
  } catch {
    return false;
  }
}

/**
 * IANA time zones offered in pickers. Validation accepts any zone the runtime knows.
 * Some ICU builds list legacy aliases (e.g. "Asia/Calcutta" instead of "Asia/Kolkata"),
 * so the current market defaults are always included.
 */
export function listTimeZones(): string[] {
  const zones = new Set(Intl.supportedValuesOf("timeZone"));
  for (const m of MARKETS) zones.add(m.timezone);
  return [...zones].sort();
}

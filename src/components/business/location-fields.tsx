"use client";

import { useState } from "react";
import { FormField } from "@/components/shared/form-field";
import { Select } from "@/components/ui/select";
import { findMarket, MARKETS } from "@/lib/markets";
import type { FieldErrors } from "@/lib/errors";

interface LocationFieldsProps {
  timeZones: string[];
  defaults: { countryCode: string; timezone: string; currency?: string; locale?: string };
  errors?: FieldErrors;
  /** Include currency and locale (organization settings) or only country/time zone (branch). */
  withRegionalSettings?: boolean;
  disabled?: boolean;
}

/** Country, time zone and (optionally) currency/locale. Choosing a country fills sensible defaults. */
export function LocationFields({
  timeZones,
  defaults,
  errors,
  withRegionalSettings,
  disabled,
}: LocationFieldsProps) {
  const [countryCode, setCountryCode] = useState(defaults.countryCode);
  const [timezone, setTimezone] = useState(defaults.timezone);
  const [currency, setCurrency] = useState(defaults.currency ?? "");
  const [locale, setLocale] = useState(defaults.locale ?? "");

  function onCountryChange(code: string) {
    setCountryCode(code);
    const market = findMarket(code);
    if (!market) return;
    setTimezone(market.timezone);
    setCurrency(market.currency);
    setLocale(market.locale);
  }

  // Keep a stored value selectable even if this runtime lists it under another alias.
  const zoneOptions = timeZones.includes(timezone) ? timeZones : [timezone, ...timeZones];
  const currencies = [
    ...new Set(MARKETS.map((m) => m.currency).concat(currency ? [currency] : [])),
  ];
  const locales = [...new Set(MARKETS.map((m) => m.locale).concat(locale ? [locale] : []))];

  return (
    <>
      <FormField id="countryCode" label="Country" errors={errors?.countryCode} required>
        <Select
          name="countryCode"
          value={countryCode}
          onChange={(e) => onCountryChange(e.target.value)}
          disabled={disabled}
        >
          {MARKETS.map((m) => (
            <option key={m.countryCode} value={m.countryCode}>
              {m.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField
        id="timezone"
        label="Time zone"
        hint="Used for opening hours, check-ins and daily reports."
        errors={errors?.timezone}
        required
      >
        <Select
          name="timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          disabled={disabled}
        >
          {zoneOptions.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </FormField>
      {withRegionalSettings && (
        <>
          <FormField id="currency" label="Default currency" errors={errors?.currency} required>
            <Select
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={disabled}
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            id="locale"
            label="Locale"
            hint="Controls number and date formatting."
            errors={errors?.locale}
            required
          >
            <Select
              name="locale"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              disabled={disabled}
            >
              {locales.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </FormField>
        </>
      )}
    </>
  );
}

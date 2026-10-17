"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = { fontSize: 12, fill: "var(--fg-text-muted)" };

/** Daily series as a bar chart. Values are pre-formatted for the tooltip by `format`. */
export function DailyBarChart({
  data,
  label,
  money,
}: {
  data: { day: string; value: number }[];
  label: string;
  money?: { currency: string; locale: string; digits: number };
}) {
  const scale = money ? 10 ** money.digits : 1;
  const points = data.map((d) => ({ day: d.day.slice(5), value: d.value / scale }));
  const fmt = (v: number) =>
    money
      ? new Intl.NumberFormat(money.locale, {
          style: "currency",
          currency: money.currency,
          maximumFractionDigits: 0,
        }).format(v)
      : String(v);
  return (
    <figure aria-label={label} className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--fg-border)" />
          <XAxis
            dataKey="day"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={money ? 72 : 32}
            tickFormatter={fmt}
            allowDecimals={false}
          />
          <Tooltip
            formatter={(v) => [fmt(Number(v)), label]}
            cursor={{ fill: "var(--fg-muted)" }}
          />
          <Bar dataKey="value" fill="var(--fg-emerald-700)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

export function DailyLineChart({
  data,
  label,
}: {
  data: { day: string; value: number }[];
  label: string;
}) {
  const points = data.map((d) => ({ day: d.day.slice(5), value: d.value }));
  return (
    <figure aria-label={label} className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--fg-border)" />
          <XAxis
            dataKey="day"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <Tooltip formatter={(v) => [String(v), label]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--fg-navy-900)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}

export function HourBarChart({
  data,
  label,
}: {
  data: { hour: number; value: number }[];
  label: string;
}) {
  const points = data.map((d) => ({ hour: `${String(d.hour).padStart(2, "0")}h`, value: d.value }));
  return (
    <figure aria-label={label} className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--fg-border)" />
          <XAxis dataKey="hour" tick={AXIS} tickLine={false} axisLine={false} interval={2} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <Tooltip formatter={(v) => [String(v), label]} cursor={{ fill: "var(--fg-muted)" }} />
          <Bar dataKey="value" fill="var(--fg-navy-700)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

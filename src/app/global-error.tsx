"use client";

/** Last-resort error page when the root layout itself fails. */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          padding: 32,
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <h1 style={{ fontSize: 22 }}>FitGrid is having trouble</h1>
        <p style={{ color: "#64748b" }}>Something went wrong on our side. Your data is safe.</p>
        <button
          onClick={reset}
          style={{
            marginTop: 12,
            padding: "8px 14px",
            background: "#047857",
            color: "#fff",
            border: 0,
            borderRadius: 8,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}

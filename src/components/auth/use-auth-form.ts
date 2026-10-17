"use client";

import { useState } from "react";

/** Minimal state for auth forms that call the Better Auth client directly. */
export function useAuthForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<{ error?: { message?: string } | null }>) {
    setPending(true);
    setError(null);
    try {
      const result = await action();
      if (result.error) {
        setError(result.error.message ?? "Something went wrong. Please try again.");
        return false;
      }
      return true;
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
      return false;
    } finally {
      setPending(false);
    }
  }

  return { pending, error, run };
}

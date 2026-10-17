import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { isAppError, ValidationError, type FieldErrors } from "@/lib/errors";
import { logger } from "@/lib/logger";

export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; message: string; fieldErrors?: FieldErrors; values?: Record<string, string> };

/**
 * Run a Server Action body and convert expected failures into a serializable result.
 * Unexpected errors are logged and replaced with a generic message.
 */
export async function runAction<T>(
  name: string,
  fn: () => Promise<T>,
  successMessage?: string,
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message: successMessage };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ValidationError) {
      return { ok: false, message: error.message, fieldErrors: error.fieldErrors };
    }
    if (isAppError(error)) return { ok: false, message: error.message };
    logger.error("action.unexpected_error", { action: name, error });
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

/** Parse untrusted input or throw a ValidationError with per-field messages. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fieldErrors: FieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_form";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    throw new ValidationError("Please correct the highlighted fields.", fieldErrors);
  }
  return result.data;
}

export function formDataToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  }
  return out;
}

/**
 * Echo submitted text values back on failure so forms can restore them
 * (React resets uncontrolled fields after a form action completes).
 */
export function withSubmittedValues<T>(
  result: ActionResult<T>,
  formData: FormData,
): ActionResult<T> {
  return result.ok ? result : { ...result, values: formDataToObject(formData) };
}

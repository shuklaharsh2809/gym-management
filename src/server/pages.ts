import "server-only";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/lib/errors";

/** Render the route's not-found UI for missing or out-of-tenant records. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

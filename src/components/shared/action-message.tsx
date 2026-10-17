import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/server/actions";

/** Shows the outcome of a Server Action submitted through useActionState. */
export function ActionMessage({ state }: { state: ActionResult<unknown> | null }) {
  if (!state) return null;
  if (state.ok) return state.message ? <Alert tone="success">{state.message}</Alert> : null;
  return <Alert tone="danger">{state.message}</Alert>;
}

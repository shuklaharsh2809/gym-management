import type { Instrumentation } from "next";

/**
 * Server error reporting hook. Errors are logged as structured JSON (the log drain/APM picks
 * them up). Swap in an error-monitoring SDK here when one is chosen.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { logger } = await import("@/lib/logger");
  logger.error("request.unhandled_error", {
    error,
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    routePath: context.routePath,
  });
};

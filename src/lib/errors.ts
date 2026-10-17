export type AppErrorCode =
  "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT";

export type FieldErrors = Record<string, string[] | undefined>;

/** Expected, user-presentable failure. Anything else is treated as an unexpected error. */
export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "You need to sign in to continue.") {
    super("UNAUTHENTICATED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super("FORBIDDEN", message);
  }
}

/**
 * Also used for records that exist in another tenant, so callers cannot probe
 * for the existence of other organizations' data.
 */
export class NotFoundError extends AppError {
  constructor(message = "The requested record was not found.") {
    super("NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    readonly fieldErrors: FieldErrors = {},
  ) {
    super("VALIDATION", message);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

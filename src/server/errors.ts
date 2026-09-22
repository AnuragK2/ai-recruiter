export type ErrorCode =
  | "validation"
  | "not_found"
  | "conflict"
  | "rate_limit"
  | "timeout"
  | "malformed"
  | "provider"
  | "config"
  | "unavailable"
  | "payload_too_large"
  | "internal";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly expose: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { status?: number; retryable?: boolean; cause?: unknown; expose?: boolean },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = options?.status ?? statusFor(code);
    this.retryable = options?.retryable ?? retryableFor(code);
    this.expose = options?.expose ?? true;
  }
}

function statusFor(code: ErrorCode): number {
  switch (code) {
    case "validation":
      return 400;
    case "payload_too_large":
      return 413;
    case "not_found":
      return 404;
    case "conflict":
      return 409;
    case "rate_limit":
      return 429;
    case "unavailable":
    case "config":
      return 503;
    case "timeout":
    case "malformed":
    case "provider":
      return 502;
    default:
      return 500;
  }
}

function retryableFor(code: ErrorCode): boolean {
  return (
    code === "rate_limit" ||
    code === "timeout" ||
    code === "malformed" ||
    code === "provider" ||
    code === "unavailable" ||
    code === "internal"
  );
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

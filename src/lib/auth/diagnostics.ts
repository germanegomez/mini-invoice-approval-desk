const MAX_DIAGNOSTIC_LENGTH = 500;

const SENSITIVE_QUERY_PARAM =
  /([?&](?:code|token|id_token|access_token|refresh_token|client_secret|assertion|state|nonce)=)[^&\s]*/gi;
const EMAIL = /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+/gi;
const BEARER_TOKEN = /\bBearer\s+[^\s,;]+/gi;
const LONG_OPAQUE_VALUE = /\b[A-Za-z0-9_-]{32,}\b/g;

export interface SanitizedAuthDiagnostic {
  errorName?: string;
  errorType?: string;
  message?: string;
  provider?: string;
  status?: number;
}

function sanitizeMessage(value: string): string {
  return value
    .replace(SENSITIVE_QUERY_PARAM, "$1[redacted]")
    .replace(EMAIL, "[redacted-email]")
    .replace(BEARER_TOKEN, "Bearer [redacted]")
    .replace(LONG_OPAQUE_VALUE, "[redacted]")
    .slice(0, MAX_DIAGNOSTIC_LENGTH);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value ? sanitizeMessage(value) : undefined;
}

function readStatus(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : undefined;
}

export function sanitizeAuthErrorMetadata(metadata: unknown): SanitizedAuthDiagnostic {
  if (!metadata || typeof metadata !== "object") return {};

  const record = metadata as Record<string, unknown>;
  const nested = record.error && typeof record.error === "object"
    ? record.error as Record<string, unknown>
    : undefined;
  const cause = nested?.cause && typeof nested.cause === "object"
    ? nested.cause as Record<string, unknown>
    : undefined;
  const response = nested?.response && typeof nested.response === "object"
    ? nested.response as Record<string, unknown>
    : undefined;

  const diagnostic: SanitizedAuthDiagnostic = {
    errorName: readString(nested?.name ?? record.name),
    errorType: readString(cause?.name ?? cause?.type ?? nested?.type),
    message: readString(cause?.message ?? nested?.message ?? record.message),
    provider: readString(record.providerId ?? record.provider),
    status: readStatus(response?.status ?? nested?.status ?? record.status),
  };

  return Object.fromEntries(
    Object.entries(diagnostic).filter(([, value]) => value !== undefined),
  ) as SanitizedAuthDiagnostic;
}

export const APPLICATION_ERROR_CODES = [
  "query_not_relevant",
  "no_match_found",
  "rate_limited",
  "openai_quota_exceeded",
  "missing_query",
] as const;

export type ApplicationErrorCode = (typeof APPLICATION_ERROR_CODES)[number];

const USER_COPY: Record<ApplicationErrorCode, string> = {
  query_not_relevant:
    "Please specify at least one team or a competition for match queries.",
  no_match_found: "No verified match was found for that query.",
  rate_limited: "Too many requests. Please wait a minute and try again.",
  openai_quota_exceeded:
    "The analysis service is temporarily unavailable. Try again later.",
  missing_query: "A query is required.",
};

export function isApplicationErrorCode(value: string): value is ApplicationErrorCode {
  return (APPLICATION_ERROR_CODES as readonly string[]).includes(value);
}

export function mapApplicationError(
  code: string | null | undefined,
  fallback?: string | null,
): string {
  if (code && isApplicationErrorCode(code)) {
    return USER_COPY[code];
  }
  if (fallback && fallback.trim()) {
    return fallback;
  }
  return "Something went wrong. Try a different question.";
}

export class ApiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiConfigError";
  }
}

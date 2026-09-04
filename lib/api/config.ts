export type ApiEnv = {
  nodeEnv?: string;
  apiUrl?: string;
};

export function normalizeApiBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

export function getApiBaseUrl(
  env: ApiEnv = {
    nodeEnv: process.env.NODE_ENV,
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
  },
): string {
  const normalized = env.apiUrl ? normalizeApiBaseUrl(env.apiUrl) : "";
  const production = env.nodeEnv === "production";

  if (production) {
    if (!normalized) {
      throw new Error("NEXT_PUBLIC_API_URL is required in production");
    }
    let parsed: URL;
    try {
      parsed = new URL(normalized);
    } catch {
      throw new Error("NEXT_PUBLIC_API_URL must be a valid absolute URL");
    }
    if (parsed.protocol !== "https:") {
      throw new Error("NEXT_PUBLIC_API_URL must use HTTPS in production");
    }
    if (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "[::1]" ||
      parsed.hostname === "::1"
    ) {
      throw new Error("NEXT_PUBLIC_API_URL must not point at localhost in production");
    }
    return normalized;
  }

  return normalized || "http://localhost:8000";
}

export function apiUrl(path: string, env?: ApiEnv): string {
  const base = getApiBaseUrl(env);
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

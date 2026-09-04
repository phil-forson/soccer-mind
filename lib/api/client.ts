import { apiUrl } from "./config";
import { mapApplicationError } from "./errors";
import { parseQueryResponse } from "./parse";
import { SseParser, type SseEvent } from "./sse";
import type { QueryRequest, QueryResponse, ThinkingMessage } from "./types";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

export function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeRequestId(value: string | null | undefined): string {
  if (value && REQUEST_ID_PATTERN.test(value)) return value;
  return createRequestId();
}

export type StreamQueryHandlers = {
  onStage?: (message: ThinkingMessage) => void;
  onResult?: (response: QueryResponse) => void;
  onError?: (error: string, message: string) => void;
};

export type StreamQueryOptions = {
  signal?: AbortSignal;
  requestId?: string;
  fetchImpl?: typeof fetch;
};

export async function streamQuery(
  request: QueryRequest,
  handlers: StreamQueryHandlers = {},
  options: StreamQueryOptions = {},
): Promise<QueryResponse> {
  const requestId = normalizeRequestId(options.requestId);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(apiUrl("/query/stream"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
    },
    body: JSON.stringify(request),
    signal: options.signal,
  });

  const headerId = response.headers.get("X-Request-ID");
  const correlatedId = headerId && REQUEST_ID_PATTERN.test(headerId) ? headerId : requestId;

  if (!response.ok) {
    throw new Error(mapApplicationError(undefined, `HTTP ${response.status}`));
  }
  if (!response.body) {
    throw new Error("No response body from /query/stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  let lastResult: QueryResponse | null = null;

  const consume = (events: SseEvent[]): boolean => {
    for (const event of events) {
      if (event.kind === "done") return true;
      if (event.kind === "stage") {
        handlers.onStage?.(event.message);
        continue;
      }
      if (event.kind === "error") {
        handlers.onError?.(event.error, event.message);
        lastResult = {
          success: false,
          request_id: correlatedId,
          intent: "general",
          summary: event.message,
          match_metadata: null,
          highlights: [],
          sources: [],
          game_analysis: null,
          error: event.error,
        };
        handlers.onResult?.(lastResult);
        continue;
      }
      const withId: QueryResponse = {
        ...event.data,
        request_id: event.data.request_id || correlatedId,
      };
      lastResult = withId;
      handlers.onResult?.(withId);
    }
    return false;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      consume(parser.flush());
      break;
    }
    const chunk = decoder.decode(value, { stream: true });
    if (consume(parser.feed(chunk))) break;
  }

  if (!lastResult) {
    throw new Error(mapApplicationError(undefined, "Stream ended without a result"));
  }
  return lastResult;
}

export function parseResultPayload(value: unknown): QueryResponse | null {
  return parseQueryResponse(value);
}

import { describe, expect, it, vi } from "vitest";
import { streamQuery } from "./client";
import { getApiBaseUrl } from "./config";
import { mapApplicationError } from "./errors";

function sseResponse(chunks: string[], headers?: HeadersInit): Response {
  const encoder = new TextEncoder();
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index]));
      index += 1;
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream", ...headers },
  });
}

describe("streamQuery", () => {
  it("POSTs /query/stream with X-Request-ID and returns a typed result", async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse(
        [
          `data: ${JSON.stringify({
            type: "result",
            data: {
              success: true,
              request_id: "server-id-1",
              intent: "fixtures",
              summary: "Upcoming fixtures listed.",
              match_metadata: null,
              highlights: [],
              sources: [],
              game_analysis: null,
              error: null,
            },
          })}\n\n`,
          "data: [DONE]\n\n",
        ],
        { "X-Request-ID": "server-id-1" },
      ),
    );

    const result = await streamQuery(
      { query: "Premier League fixtures", include_highlights: false },
      {},
      { fetchImpl: fetchImpl as unknown as typeof fetch, requestId: "client-req-123456" },
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/query\/stream$/);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-Request-ID"]).toBe(
      "client-req-123456",
    );
    expect(result.intent).toBe("fixtures");
    expect(result.request_id).toBe("server-id-1");
  });

  it("aborts a superseded stream", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const pending = streamQuery(
      { query: "Arsenal vs Chelsea" },
      {},
      { fetchImpl: fetchImpl as unknown as typeof fetch, signal: controller.signal },
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("config", () => {
  it("defaults to localhost in development and strips a trailing slash", () => {
    expect(getApiBaseUrl({ nodeEnv: "development" })).toBe("http://localhost:8000");
    expect(
      getApiBaseUrl({
        nodeEnv: "development",
        apiUrl: "http://localhost:8000/",
      }),
    ).toBe("http://localhost:8000");
  });

  it("refuses localhost and non-HTTPS URLs in production", () => {
    expect(() => getApiBaseUrl({ nodeEnv: "production" })).toThrow(
      /NEXT_PUBLIC_API_URL is required/,
    );
    expect(() =>
      getApiBaseUrl({ nodeEnv: "production", apiUrl: "http://localhost:8000" }),
    ).toThrow(/HTTPS/);
    expect(() =>
      getApiBaseUrl({
        nodeEnv: "production",
        apiUrl: "https://localhost:8000",
      }),
    ).toThrow(/localhost/);
    expect(() =>
      getApiBaseUrl({
        nodeEnv: "production",
        apiUrl: "https://[::1]/",
      }),
    ).toThrow(/localhost/);
    expect(
      getApiBaseUrl({
        nodeEnv: "production",
        apiUrl: "https://api.example.com/",
      }),
    ).toBe("https://api.example.com");
  });
});

describe("error mapping", () => {
  it("maps known application errors", () => {
    expect(mapApplicationError("query_not_relevant")).toMatch(/team or a competition/);
    expect(mapApplicationError("no_match_found")).toMatch(/No verified match/);
    expect(mapApplicationError("rate_limited")).toMatch(/Too many requests/);
    expect(mapApplicationError("openai_quota_exceeded")).toMatch(/temporarily unavailable/);
    expect(mapApplicationError("missing_query")).toMatch(/required/);
    expect(mapApplicationError("mystery_code", "Custom")).toBe("Custom");
  });
});

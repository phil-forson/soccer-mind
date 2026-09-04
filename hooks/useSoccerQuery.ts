"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createRequestId, streamQuery } from "@/lib/api/client";
import { mapApplicationError } from "@/lib/api/errors";
import type { QueryRequest, QueryResponse, ThinkingMessage } from "@/lib/api/types";

export function useSoccerQuery() {
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [thinking, setThinking] = useState<ThinkingMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const runQuery = useCallback(async (request: QueryRequest) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const id = createRequestId();
    setRequestId(id);
    setLoading(true);
    setStreamActive(true);
    setError(null);
    setResult(null);
    setThinking([]);

    try {
      const response = await streamQuery(
        request,
        {
          onStage: (message) => {
            setThinking((prev) => [...prev, message].slice(-12));
          },
          onResult: (data) => {
            setResult(data);
            setRequestId(data.request_id || id);
            if (!data.success) {
              setError(mapApplicationError(data.error, data.summary));
            }
          },
          onError: (code, message) => {
            setError(mapApplicationError(code, message));
          },
        },
        { signal: controller.signal, requestId: id },
      );

      if (!response.success) {
        setError(mapApplicationError(response.error, response.summary));
      }
      return response;
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "AbortError") return null;
      setError(err instanceof Error ? err.message : mapApplicationError(undefined));
      return null;
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
        setStreamActive(false);
      }
    }
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setResult(null);
    setThinking([]);
    setError(null);
    setLoading(false);
    setStreamActive(false);
  }, []);

  return {
    result,
    thinking,
    error,
    loading,
    streamActive,
    requestId,
    runQuery,
    abort,
    reset,
  };
}

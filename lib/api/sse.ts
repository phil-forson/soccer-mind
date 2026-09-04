import { parseQueryResponse, parseThinkingMessage, isRecord } from "./parse";
import type { QueryResponse, ThinkingMessage } from "./types";

export type SseDoneEvent = { kind: "done" };

export type SseStageEvent = { kind: "stage"; message: ThinkingMessage };

export type SseResultEvent = { kind: "result"; data: QueryResponse };

export type SseErrorEvent = {
  kind: "error";
  error: string;
  message: string;
};

export type SseEvent = SseDoneEvent | SseStageEvent | SseResultEvent | SseErrorEvent;

export function normalizeSseNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function dataPayload(block: string): string | null {
  const lines = block.split("\n");
  const dataLines: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/^\uFEFF/, "");
    if (!line.trim() || line.startsWith(":")) continue;
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
  }
  if (dataLines.length === 0) return null;
  return dataLines.join("\n");
}

export function parseSseBlock(block: string): SseEvent | null {
  const payload = dataPayload(block);
  if (payload === null) return null;
  if (payload === "[DONE]") return { kind: "done" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  if (parsed.type === "result") {
    const data = parseQueryResponse(parsed.data);
    return data ? { kind: "result", data } : null;
  }

  if (parsed.type === "error") {
    const error =
      typeof parsed.error === "string" ? parsed.error : "unknown_error";
    const message =
      typeof parsed.message === "string" ? parsed.message : error;
    if (isRecord(parsed.data)) {
      const asResult = parseQueryResponse(parsed.data);
      if (asResult) return { kind: "result", data: asResult };
    }
    return { kind: "error", error, message };
  }

  const stage = parseThinkingMessage(parsed);
  if (stage) return { kind: "stage", message: stage };
  return null;
}

export class SseParser {
  private buffer = "";

  feed(chunk: string): SseEvent[] {
    this.buffer += normalizeSseNewlines(chunk);
    const events: SseEvent[] = [];
    while (true) {
      const idx = this.buffer.indexOf("\n\n");
      if (idx === -1) break;
      const block = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 2);
      const event = parseSseBlock(block);
      if (event) events.push(event);
    }
    return events;
  }

  flush(): SseEvent[] {
    if (!this.buffer.trim()) {
      this.buffer = "";
      return [];
    }
    const event = parseSseBlock(this.buffer);
    this.buffer = "";
    return event ? [event] : [];
  }
}

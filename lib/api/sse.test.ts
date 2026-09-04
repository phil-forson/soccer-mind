import { describe, expect, it } from "vitest";
import { SseParser, parseSseBlock } from "./sse";
import { parseQueryResponse, parseSourceCitation } from "./parse";
import { shouldShowScoreCard, isMatchOrientedIntent } from "./types";

const finishedResult = {
  success: true,
  request_id: "req-finished-1",
  intent: "match_result",
  summary: "Liverpool drew 1-1 with Sunderland.",
  match_metadata: {
    home_team: "Liverpool",
    away_team: "Sunderland",
    match_date: "2025-12-03",
    score: "1-1",
    competition: "Premier League",
    key_moments: [],
    man_of_the_match: null,
    match_summary: null,
    evidence_status: "finished",
    claim_evidence: [
      {
        claim: "score",
        evidence_chunk_ids: ["chk_1"],
        confidence: 0.92,
        status: "supported",
      },
    ],
    no_match_found: false,
  },
  highlights: [],
  sources: [
    {
      id: "src_1",
      url: "https://www.espn.com/report",
      title: "Liverpool vs Sunderland match report",
      domain: "espn.com",
    },
  ],
  game_analysis: null,
  error: null,
};

function resultEvent(data: unknown): string {
  return `data: ${JSON.stringify({ type: "result", data })}\n\n`;
}

describe("SSE parser", () => {
  it("reassembles events split at arbitrary byte boundaries", () => {
    const payload = `data: ${JSON.stringify({
      stage: "query_parser",
      message: "Analyzing your query...",
      status: "starting",
      data: {},
    })}\n\n${resultEvent(finishedResult)}data: [DONE]\n\n`;

    const parser = new SseParser();
    const events = [];
    for (let i = 0; i < payload.length; i += 7) {
      events.push(...parser.feed(payload.slice(i, i + 7)));
    }
    events.push(...parser.flush());

    expect(events.map((e) => e.kind)).toEqual(["stage", "result", "done"]);
    const result = events.find((e) => e.kind === "result");
    expect(result?.kind === "result" && result.data.request_id).toBe("req-finished-1");
  });

  it("normalizes CRLF event separators", () => {
    const payload = `data: ${JSON.stringify({
      stage: "web_search",
      message: "Searching",
      status: "starting",
    })}\r\n\r\n${resultEvent(finishedResult).replace(/\n/g, "\r\n")}data: [DONE]\r\n\r\n`;

    const parser = new SseParser();
    const events = parser.feed(payload);
    expect(events.map((e) => e.kind)).toEqual(["stage", "result", "done"]);
  });

  it("ignores comments and keepalives", () => {
    const events = new SseParser().feed(
      `: keepalive\n\n${resultEvent(finishedResult)}data: [DONE]\n\n`,
    );
    expect(events.map((e) => e.kind)).toEqual(["result", "done"]);
  });

  it("handles type:error for forward compatibility", () => {
    const event = parseSseBlock(
      `data: ${JSON.stringify({
        type: "error",
        error: "openai_quota_exceeded",
        message: "Our AI engine has run out of credits.",
      })}`,
    );
    expect(event).toEqual({
      kind: "error",
      error: "openai_quota_exceeded",
      message: "Our AI engine has run out of credits.",
    });
  });

  it("treats type:result plus success:false as an application error payload", () => {
    const event = parseSseBlock(
      resultEvent({
        success: false,
        request_id: "req-rate",
        intent: "general",
        summary: "Too many requests.",
        error: "rate_limited",
        match_metadata: null,
        highlights: [],
        sources: [],
        game_analysis: null,
      }).trim(),
    );
    expect(event?.kind).toBe("result");
    if (event?.kind === "result") {
      expect(event.data.success).toBe(false);
      expect(event.data.error).toBe("rate_limited");
    }
  });
});

describe("structured sources", () => {
  it("parses source objects and rejects URL strings", () => {
    const parsed = parseQueryResponse({
      ...finishedResult,
      sources: [
        {
          id: "src_1",
          url: "https://www.espn.com/report",
          title: "Report",
          domain: "espn.com",
        },
        "https://should-not-be-accepted.example",
      ],
    });
    expect(parsed?.sources).toEqual([
      {
        id: "src_1",
        url: "https://www.espn.com/report",
        title: "Report",
        domain: "espn.com",
      },
    ]);
    expect(parseSourceCitation("https://example.com")).toBeNull();
  });
});

describe("evidence and intents", () => {
  it("does not show a score card for insufficient or conflicting evidence", () => {
    expect(
      shouldShowScoreCard({
        ...finishedResult.match_metadata,
        evidence_status: "insufficient",
        score: "1-1",
      }),
    ).toBe(false);
    expect(
      shouldShowScoreCard({
        ...finishedResult.match_metadata,
        evidence_status: "conflicting",
        score: "2-1",
      }),
    ).toBe(false);
  });

  it("treats no_match_found as a non-score state", () => {
    expect(
      shouldShowScoreCard({
        ...finishedResult.match_metadata,
        no_match_found: true,
        score: "1-0",
      }),
    ).toBe(false);
  });

  it("does not treat a live score as a finished result card", () => {
    expect(
      shouldShowScoreCard({
        ...finishedResult.match_metadata,
        evidence_status: "live",
        score: "1-0",
      }),
    ).toBe(false);
  });

  it("shows a scheduled card without requiring a score, and a finished card with a score", () => {
    expect(
      shouldShowScoreCard({
        ...finishedResult.match_metadata,
        score: null,
        evidence_status: "scheduled",
      }),
    ).toBe(true);
    expect(
      shouldShowScoreCard({
        ...finishedResult.match_metadata,
        evidence_status: "finished",
        score: "1-1",
      }),
    ).toBe(true);
  });

  it("treats empty highlights as a valid successful payload", () => {
    const parsed = parseQueryResponse(finishedResult);
    expect(parsed?.success).toBe(true);
    expect(parsed?.highlights).toEqual([]);
  });

  it("accepts non-match intents without match metadata", () => {
    const parsed = parseQueryResponse({
      success: true,
      request_id: "req-table",
      intent: "standings",
      summary: "Arsenal lead the Premier League.",
      match_metadata: null,
      highlights: [],
      sources: [
        {
          id: "src_1",
          url: "https://www.premierleague.com/tables",
          title: "Table",
          domain: "premierleague.com",
        },
      ],
      game_analysis: null,
      error: null,
    });
    expect(parsed?.intent).toBe("standings");
    expect(parsed?.match_metadata).toBeNull();
    expect(isMatchOrientedIntent("standings")).toBe(false);
    expect(isMatchOrientedIntent("match_result")).toBe(true);
    expect(shouldShowScoreCard(parsed?.match_metadata)).toBe(false);
  });
});

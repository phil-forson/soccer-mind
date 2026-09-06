import { describe, expect, it } from "vitest";
import { parseFplRankings } from "./fpl";

describe("parseFplRankings", () => {
  it("parses predicted rows and rejects junk", () => {
    const parsed = parseFplRankings({
      success: true,
      request_id: "req-fpl-1",
      gameweek: 3,
      forecast_gameweek: 3,
      ranking_kind: "predicted_edge",
      disclaimer: "These ranks are model predictions from the FPL engine, not verified match facts.",
      rows: [
        {
          rank: 1,
          player_id: 1,
          name: "Saka",
          team: "ARS",
          position: "MID",
          price: 10,
          ownership: 40,
          predicted_edge: 5.2,
          predicted_metric: "edge_score",
          form: 7.8,
          chance_of_playing: 100,
          news: "",
        },
        "not-a-row",
      ],
      snapshot_at: "2026-09-04T00:00:00+00:00",
      error: null,
    });
    expect(parsed?.rows).toHaveLength(1);
    expect(parsed?.rows[0]?.name).toBe("Saka");
    expect(parsed?.disclaimer).toMatch(/predictions/);
  });

  it("keeps a finished-GW failure as an empty predicted state", () => {
    const parsed = parseFplRankings({
      success: false,
      request_id: "req-fpl-2",
      gameweek: 3,
      forecast_gameweek: 4,
      ranking_kind: "predicted_edge",
      disclaimer: "These ranks are model predictions from the FPL engine, not verified match facts.",
      rows: [],
      snapshot_at: null,
      error: "gameweek_finished",
    });
    expect(parsed?.success).toBe(false);
    expect(parsed?.error).toBe("gameweek_finished");
    expect(parsed?.rows).toEqual([]);
  });
});

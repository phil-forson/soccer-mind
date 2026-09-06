import { apiUrl } from "./config";
import { isRecord } from "./parse";

export type FPLRankingRow = {
  rank: number;
  player_id: number;
  name: string;
  team: string;
  position: string;
  price: number;
  ownership: number;
  predicted_edge: number;
  predicted_metric: string;
  form: number;
  chance_of_playing: number | null;
  news: string;
};

export type FPLRankingsResponse = {
  success: boolean;
  request_id: string;
  gameweek: number | null;
  forecast_gameweek: number | null;
  ranking_kind: string;
  disclaimer: string;
  rows: FPLRankingRow[];
  snapshot_at: string | null;
  error: string | null;
};

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseRow(value: unknown): FPLRankingRow | null {
  if (!isRecord(value)) return null;
  const rank = asNumber(value.rank);
  const player_id = asNumber(value.player_id);
  const name = asString(value.name);
  const team = asString(value.team);
  const position = asString(value.position);
  const predicted_edge = asNumber(value.predicted_edge);
  if (
    rank === null ||
    player_id === null ||
    !name ||
    !team ||
    !position ||
    predicted_edge === null
  ) {
    return null;
  }
  return {
    rank,
    player_id,
    name,
    team,
    position,
    price: asNumber(value.price) ?? 0,
    ownership: asNumber(value.ownership) ?? 0,
    predicted_edge,
    predicted_metric: asString(value.predicted_metric) || "edge_score",
    form: asNumber(value.form) ?? 0,
    chance_of_playing: asNumber(value.chance_of_playing),
    news: asString(value.news) ?? "",
  };
}

export function parseFplRankings(value: unknown): FPLRankingsResponse | null {
  if (!isRecord(value)) return null;
  if (typeof value.success !== "boolean") return null;
  const request_id = asString(value.request_id);
  const disclaimer = asString(value.disclaimer);
  if (!request_id || disclaimer === null) return null;
  const rows = Array.isArray(value.rows)
    ? value.rows.flatMap((row) => {
        const parsed = parseRow(row);
        return parsed ? [parsed] : [];
      })
    : [];
  return {
    success: value.success,
    request_id,
    gameweek: asNumber(value.gameweek),
    forecast_gameweek: asNumber(value.forecast_gameweek),
    ranking_kind: asString(value.ranking_kind) || "predicted_edge",
    disclaimer,
    rows,
    snapshot_at: asString(value.snapshot_at),
    error: asString(value.error),
  };
}

export async function fetchFplRankings(options: {
  gameweek?: number;
  limit?: number;
  signal?: AbortSignal;
} = {}): Promise<FPLRankingsResponse> {
  const params = new URLSearchParams();
  if (options.gameweek != null) params.set("gameweek", String(options.gameweek));
  params.set("limit", String(options.limit ?? 10));
  const url = `${apiUrl("/fpl/rankings")}?${params.toString()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: options.signal,
  });
  const json: unknown = await response.json();
  const parsed = parseFplRankings(json);
  if (!parsed) {
    throw new Error("Unexpected FPL rankings payload");
  }
  return parsed;
}

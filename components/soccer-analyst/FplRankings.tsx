"use client";

import { useState } from "react";
import { fetchFplRankings, type FPLRankingsResponse } from "@/lib/api/fpl";

export function FplRankings() {
  const [gameweek, setGameweek] = useState("3");
  const [data, setData] = useState<FPLRankingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const gw = gameweek.trim() ? Number(gameweek) : undefined;
      const result = await fetchFplRankings({
        gameweek: Number.isFinite(gw) ? gw : undefined,
        limit: 10,
      });
      setData(result);
      if (!result.success) {
        setError(
          result.error === "gameweek_finished"
            ? "That Gameweek is finished. The engine will not invent a retrospective top 10."
            : result.error === "gameweek_not_forecastable"
              ? "That Gameweek is not the current forecast window."
              : result.error || "No FPL ranking available.",
        );
      }
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Could not load FPL rankings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-8 w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-5 text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-white/60">
            FPL rankings
          </h2>
          <p className="mt-1 text-xs text-white/40">
            Predicted edge, not verified match facts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/50" htmlFor="fpl-gw">
            Gameweek
          </label>
          <input
            id="fpl-gw"
            type="number"
            min={1}
            max={38}
            value={gameweek}
            onChange={(event) => setGameweek(event.target.value)}
            className="w-16 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-sm text-white outline-none focus:border-white/30"
          />
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-60"
          >
            {loading ? "Loading…" : "Load top 10"}
          </button>
        </div>
      </div>

      {data?.disclaimer ? (
        <p className="mt-3 text-[11px] text-amber-200/80">{data.disclaimer}</p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-rose-400">{error}</p> : null}
      {data?.request_id ? (
        <p className="mt-1 text-[10px] text-white/30">Request {data.request_id}</p>
      ) : null}

      {data?.success && data.rows.length > 0 ? (
        <ol className="mt-4 space-y-2">
          {data.rows.map((row) => (
            <li
              key={row.player_id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-white">
                  {row.rank}. {row.name}{" "}
                  <span className="text-white/40">
                    {row.team} · {row.position}
                  </span>
                </p>
                <p className="text-[11px] text-white/40">
                  Form {row.form}
                  {row.chance_of_playing != null ? ` · COP ${row.chance_of_playing}%` : ""}
                  {row.news ? ` · ${row.news}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-white/35">Predicted edge</p>
                <p className="font-semibold text-white">{row.predicted_edge.toFixed(2)}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

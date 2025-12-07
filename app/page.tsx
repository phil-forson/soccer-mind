"use client";

import { useMemo, useState } from "react";

type ApiHighlight = {
  title?: string;
  url?: string;
  duration?: string;
  source_type?: string | null;
  is_nbc_sports?: boolean | null;
  is_official_club?: boolean | null;
  confidence?: number | null;
};

type ApiKeyMoment = {
  minute?: string;
  event?: string;
  description?: string;
  team?: string;
  momentum_impact?: string;
  reasoning?: string;
};

type ApiMatchMetadata = {
  home_team?: string;
  away_team?: string;
  match_date?: string;
  score?: string;
  competition?: string;
  key_moments?: ApiKeyMoment[];
  man_of_the_match?: string;
  match_summary?: string;
};

type ApiResponse = {
  success?: boolean;
  intent?: string | null;
  summary?: string | null;
  match_metadata?: ApiMatchMetadata | null;
  highlights?: ApiHighlight[] | string[];
  sources?: string[];
  game_analysis?: {
    deep_analysis?: string;
    momentum_analysis?: ApiKeyMoment[];
    tactical_analysis?: Record<string, unknown>;
  } | null;
  error?: string | null;
  answer?: string | null;
};

type ThinkingEvent = {
  stage: string;
  message: string;
  status: string;
};

const backgroundUrl =
  "https://images.unsplash.com/photo-1508609349937-5ec4ae374ebf?auto=format&fit=crop&w=1920&q=80";

const normalizeResponse = (data: any): ApiResponse => ({
  ...data,
  summary: data?.summary ?? data?.answer ?? null,
  highlights: Array.isArray(data?.highlights) ? data.highlights : [],
  sources: Array.isArray(data?.sources) ? data.sources : [],
});

export default function Home() {
  const [query, setQuery] = useState("");
  const [includeHighlights, setIncludeHighlights] = useState(true);
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState<ThinkingEvent[]>([]);
  const [streamActive, setStreamActive] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStreamActive(true);
    setError(null);
    setApiData(null);
    setThinking([]);

    try {
      const res = await fetch("http://localhost:8000/query/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, include_highlights: includeHighlights }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const messages = buffer.split("\n\n");
        buffer = messages.pop() ?? "";

        for (const raw of messages) {
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.replace(/^data:\s*/, "");

          try {
            const json = JSON.parse(payload);
            const stageLike = json.stage || json?.data?.stage;
            const statusLike = json.status || json?.data?.status;
            const messageLike = json.message || json?.data?.message;

            if (json.type === "result") {
              setApiData(normalizeResponse(json.data));
            } else if (json.type === "thinking" || stageLike) {
              setThinking((prev) =>
                [
                  ...prev,
                  {
                    stage: stageLike || "thinking",
                    message: messageLike || "",
                    status: statusLike || "info",
                  },
                ].slice(-12),
              );
            }
          } catch {
            // ignore malformed chunk
          }
        }
      }
    } catch (err) {
      setError("Could not reach the Soccer LLM Analyst API.");
    } finally {
      setLoading(false);
      setStreamActive(false);
    }
  };

  const keyMoments = useMemo(
    () => apiData?.match_metadata?.key_moments ?? [],
    [apiData],
  );

  const highlightCards: ApiHighlight[] = useMemo(() => {
    if (!apiData?.highlights) return [];
    if (Array.isArray(apiData.highlights)) {
      return apiData.highlights.map((h) =>
        typeof h === "string" ? { title: h } : h,
      );
    }
    return [];
  }, [apiData]);

  const primaryHighlight = useMemo(() => {
    return highlightCards.find((h) => h.url) || null;
  }, [highlightCards]);

  const embedUrl = (url?: string) => {
    if (!url) return null;
    try {
      if (url.includes("youtube.com/watch?v=")) {
        const videoId = new URL(url).searchParams.get("v");
        return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=0` : url;
      }
      if (url.includes("youtu.be/")) {
        const id = url.split("youtu.be/")[1]?.split("?")[0];
        return id ? `https://www.youtube.com/embed/${id}?autoplay=0` : url;
      }
      return url;
    } catch {
      return url;
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060a] text-white">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            "linear-gradient(120deg, rgba(6,8,18,0.94), rgba(10,12,24,0.9))",
            "radial-gradient(circle at 72% 18%, rgba(167,189,255,0.16), transparent 32%)",
            "radial-gradient(circle at 18% 26%, rgba(255,214,195,0.16), transparent 30%)",
            "url('https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=2400&q=80')",
          ].join(","),
          backgroundSize: "cover, 120% 120%, 120% 120%, cover",
          backgroundPosition: "center, 50% 50%, 20% 30%, center",
          backgroundBlendMode: "normal, screen, screen, multiply",
          filter: "saturate(0.9)",
        }}
      />
      <div
        className="absolute inset-0 opacity-45"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "160px 160px, 160px 160px",
        }}
      />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_45%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 pb-20 pt-12 md:px-12">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur">
            <span className="text-lg">⚽️</span>
          </div>
          <h1 className="text-4xl font-semibold sm:text-5xl lg:text-6xl">
            AI Match Insights
          </h1>
          <p className="mx-auto max-w-2xl text-base text-white/70">
            Stream live reasoning, get instant match insights, and watch validated highlights —
            all in one place.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs text-white/70">
              <span className="h-2 w-2 rounded-full bg-lime-400" />
              Live SSE stream from /query/stream
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs text-white/70">
              <span className="h-2 w-2 rounded-full bg-rose-300" />
              Highlights embedded inline
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
            <section className="flex flex-col gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 shadow-lg shadow-purple-500/25" />
                    <div>
                      <p className="text-sm font-semibold">Soccer LLM Analyst</p>
                      <p className="text-xs text-white/60">
                        {apiData ? "Live response" : streamActive ? "Streaming..." : "Awaiting query"}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                    POST /query/stream
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                    Thinking
                  </p>
                  <div className="space-y-3">
                    {thinking.length ? (
                      thinking.slice(-4).map((item, idx) => (
                        <div
                          key={`${item.stage}-${idx}`}
                          className={`flex items-start gap-3 rounded-2xl px-3 py-2 ${
                            item.status === "complete"
                              ? "bg-emerald-400/15"
                              : item.status === "processing"
                                ? "bg-amber-400/15"
                                : item.status === "starting"
                                  ? "bg-sky-400/15"
                                  : "bg-white/10"
                          }`}
                        >
                          <div className="mt-1 h-2 w-2 rounded-full bg-lime-400" />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs text-white/70">
                              <span className="capitalize">{item.stage}</span>
                              <span>•</span>
                              <span>{item.status}</span>
                            </div>
                            <p className="text-sm text-white/85">{item.message}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-white/60">
                        Waiting for events from /query/stream…
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-black/30 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                    Model response
                  </p>
                  <p className="text-sm leading-relaxed text-white/85">
                    {apiData?.summary ||
                      (loading
                        ? "Analyzing your question..."
                        : "Responses will appear here once you submit your question.")}
                  </p>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="mt-4 flex flex-col gap-3 rounded-xl border border-white/10 bg-black/30 p-3"
                >
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask a match question... (e.g., How did Barcelona create overloads vs Real Madrid?)"
                    className="min-h-[100px] w-full rounded-lg border border-white/10 bg-black/40 px-3 py-3 text-sm text-white placeholder-white/50 outline-none ring-1 ring-transparent transition focus:border-lime-400/50 focus:ring-lime-400/30"
                    required
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex items-center gap-3 text-sm font-medium text-white">
                      <span className="text-white/80">Include highlights</span>
                      <div className="flex items-center gap-2 text-xs text-white/60">
                        Returns key clips when available
                      </div>
                      <span className="sr-only">Include highlights toggle</span>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={includeHighlights}
                          onChange={(e) => setIncludeHighlights(e.target.checked)}
                        />
                        <div className="peer h-6 w-12 rounded-full bg-white/20 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-lime-400 peer-checked:after:translate-x-6" />
                      </label>
                    </label>
                    <button
                      type="submit"
                      className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-300 to-pink-400 px-5 py-3 text-sm font-semibold text-black shadow-lg shadow-amber-300/25 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={loading || !query.trim()}
                    >
                      {loading ? "Streaming..." : "Send"}
                      <span className="text-lg leading-none">➜</span>
                    </button>
                  </div>
                  {error && (
                    <p className="text-xs text-rose-300">{error}</p>
                  )}
                </form>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Comprehensive analysis</p>
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-white/85">
                  <p>
                    {apiData?.game_analysis?.deep_analysis
                      ? "Full tactical and momentum breakdown:"
                      : apiData
                        ? "Waiting on deep analysis from the stream..."
                        : "Analysis will appear here after your query."}
                  </p>
                  {apiData?.game_analysis?.deep_analysis && (
                    <div className="space-y-2 rounded-xl bg-white/5 p-3 text-sm text-white/80">
                      <div className="whitespace-pre-line">{apiData.game_analysis.deep_analysis}</div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <aside className="flex flex-col gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white/90">Match snapshot</p>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                    {apiData?.match_metadata?.competition || "Competition"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-white/80">
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    <p className="text-white/60">Score</p>
                    <p className="text-lg font-semibold">
                      {apiData?.match_metadata?.score || "—"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    <p className="text-white/60">Date</p>
                    <p className="font-semibold">
                      {apiData?.match_metadata?.match_date || "—"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    <p className="text-white/60">Home</p>
                    <p className="font-semibold">
                      {apiData?.match_metadata?.home_team || "—"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2">
                    <p className="text-white/60">Away</p>
                    <p className="font-semibold">
                      {apiData?.match_metadata?.away_team || "—"}
                    </p>
                  </div>
                  <div className="col-span-2 rounded-xl bg-white/5 px-3 py-2">
                    <p className="text-white/60">MOTM</p>
                    <p className="font-semibold">
                      {apiData?.match_metadata?.man_of_the_match || "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white/90">Key moments</p>
                    <span className="text-xs text-white/60">
                      {keyMoments?.length ? `${keyMoments.length} events` : "No data"}
                    </span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {keyMoments?.length ? (
                      keyMoments.map((moment, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 rounded-xl bg-white/10 px-3 py-2 text-sm text-white/85"
                        >
                          <div className="rounded-full bg-gradient-to-br from-lime-300/60 to-emerald-400/60 px-2 py-1 text-xs font-semibold text-black">
                            {moment.minute || "—"}
                          </div>
                          <div className="space-y-1">
                            <p className="font-semibold">{moment.event || "Event"}</p>
                            <p className="text-white/70">{moment.description}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-white/60">
                        Key moments will appear here when returned by the API.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white/90">Highlights & Sources</p>
                  <span className="text-xs text-white/60">
                    {includeHighlights ? "Highlights on" : "Highlights off"}
                  </span>
                </div>

                {primaryHighlight && embedUrl(primaryHighlight.url) ? (
                  <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/60">
                    <iframe
                      title={primaryHighlight.title || "Match highlight"}
                      src={embedUrl(primaryHighlight.url) || undefined}
                      className="aspect-video w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                    <div className="space-y-1 px-3 py-2 text-sm">
                      <p className="font-semibold text-white/90">
                        {primaryHighlight.title || "Highlight clip"}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-white/70">
                        {primaryHighlight.duration && <span>{primaryHighlight.duration}</span>}
                        {primaryHighlight.confidence && (
                          <span className="rounded-full bg-lime-400/20 px-2 py-1">
                            confidence {(primaryHighlight.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-white/60">
                    Clips will appear when highlights are returned.
                  </p>
                )}

                {highlightCards.length > 1 && (
                  <div className="mt-3 space-y-2">
                    {highlightCards.slice(1).map((item, idx) => (
                      <a
                        key={idx}
                        href={item.url || "#"}
            target="_blank"
            rel="noopener noreferrer"
                        className="block rounded-xl border border-white/10 bg-white/10 px-3 py-3 transition hover:border-lime-300/60 hover:bg-white/15"
                      >
                        <p className="text-sm font-semibold text-white/90">
                          {item.title || "Highlight clip"}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-white/70">
                          {item.duration && <span>{item.duration}</span>}
                          {item.confidence && (
                            <span className="rounded-full bg-lime-400/20 px-2 py-1">
                              confidence {(item.confidence * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white/90">Sources</p>
                    <span className="text-xs text-white/60">
                      {apiData?.sources?.length ? `${apiData.sources.length} links` : "—"}
                    </span>
                  </div>
                  <div className="mt-2 space-y-2 text-sm text-white/80">
                    {apiData?.sources?.length ? (
                      apiData.sources.map((src, idx) => (
                        <div
                          key={idx}
                          className="truncate rounded-lg bg-white/10 px-3 py-2 hover:bg-white/15"
                        >
                          <a
                            href={src}
            target="_blank"
            rel="noopener noreferrer"
                            className="underline decoration-lime-300/60 underline-offset-2"
                          >
                            {src}
                          </a>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-white/60">Sources will appear here.</p>
                    )}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

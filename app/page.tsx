"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { useSoccerQuery } from "@/hooks/useSoccerQuery";
import type { HighlightVideo, MatchMetadata, SourceCitation } from "@/lib/api/types";
import { isMatchOrientedIntent, shouldShowScoreCard } from "@/lib/api/types";

const LOGO_ALIASES: Record<string, string> = {
  "arsenal": "arsenal",
  "arsenal fc": "arsenal",
  "aston villa": "aston-villa",
  "aston villa fc": "aston-villa",
  "ac milan": "ac-milan",
  "milan": "ac-milan",
  "athletic bilbao": "athletic-bilbao",
  "bilbao": "athletic-bilbao",
  "atalanta": "atalanta",
  "barcelona": "barcelona",
  "fc barcelona": "barcelona",
  "barca": "barcelona",
  "bayer leverkusen": "bayer-leverkusen",
  "leverkusen": "bayer-leverkusen",
  "bayern": "bayern",
  "bayern munich": "bayern",
  "fc bayern": "bayern",
  "benfica": "benfica",
  "real betis": "betis",
  "betis": "betis",
  "bournemouth": "bournemouth",
  "brighton": "brighton",
  "brighton & hove albion": "brighton",
  "burnley": "burnley",
  "brentford": "brentford",
  "brentford fc": "brentford",
  "brentford football club": "brentford",
  "brentford fc cf": "brentford",
  "chelsea": "chelsea",
  "chelsea fc": "chelsea",
  "chelsea football club": "chelsea",
  "chelsea fc cf": "chelsea",
  "crystal palace": "crystal-palace",
  "palace": "crystal-palace",
  "crystal palace fc": "crystal-palace",
  "crystal palace football club": "crystal-palace",
  "crystal palace fc cf": "crystal-palace",
  "borussia dortmund": "dortmund",
  "dortmund": "dortmund",
  "fc dortmund": "dortmund",
  "espanyol": "espanyol",
  "espanyol barcelona": "espanyol",
  "everton": "everton",
  "everton fc": "everton",
  "everton football club": "everton",
  "everton fc cf": "everton",
  "inter miami": "inter-miami",
  "inter miami cf": "inter-miami",
  "inter milan": "inter-milan",
  "inter": "inter-milan",
  "inter fc": "inter-milan",
  "fc internazionale": "inter-milan",
  "galatasaray": "galatasaray",
  "galatasaray fc": "galatasaray",
  "galatasaray football club": "galatasaray",
  "galatasaray fc cf": "galatasaray",
  "galatasaray afc": "galatasaray",
  "juventus": "juventus",
  "juve": "juventus",
  "leeds": "leeds",
  "leeds united": "leeds",
  "leicester": "leicester",
  "leicester city": "leicester",
  "rb leipzig": "leipzig",
  "leipzig": "leipzig",
  "liverpool": "liverpool",
  "liverpool fc": "liverpool",
  "manchester city": "manchester-city",
  "man city": "manchester-city",
  "city": "manchester-city",
  "manchester united": "manchester-united",
  "man united": "manchester-united",
  "man utd": "manchester-united",
  "man u": "manchester-united",
  "newcastle": "newcastle",
  "newcastle united": "newcastle",
  "psg": "psg",
  "paris saint-germain": "psg",
  "real madrid": "real-madrid",
  "madrid": "real-madrid",
  "as roma": "roma",
  "roma": "roma",
  "sevilla": "sevilla",
  "valencia": "valencia",
  "tottenham": "tottenham",
  "tottenham hotspur": "tottenham",
  "spurs": "tottenham",
  "west ham": "westham-united",
  "west ham united": "westham-united",
  "bournemouth afc": "bournemouth",
  "bournemouth football club": "bournemouth",
  "bournemouth fc cf": "bournemouth",
  "afc bournemouth": "bournemouth",
  "wolves": "wolves",
  "wolverhampton wanderers": "wolves",
  "wolverhampton": "wolves",

  "sunderland": "sunderland",
  "bayer 04 leverkusen": "bayer-leverkusen",
  "fc bayern munich": "bayern",
  "fc porto": "porto",
  "celta de vigo": "celta-vigo",
  "celta": "celta-vigo",
  "celta de vigo fc": "celta-vigo",
  "celta de vigo cf": "celta-vigo",
  "celta vigo": "celta-vigo",
};

const normalizeTeam = (name?: string) =>
  name?.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() || "";

const logoForTeam = (name?: string) => {
  const norm = normalizeTeam(name);
  if (!norm) return null;
  const mapped = LOGO_ALIASES[norm];
  if (mapped) return `/logos/${mapped}.png`;
  const slug = norm.replace(/\s+/g, "-");
  return `/logos/${slug}.png`;
};

const httpsHref = (url?: string | null): string | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
};

const youtubeEmbedUrl = (url?: string | null): string | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (parsed.pathname === "/watch") {
        const videoId = parsed.searchParams.get("v");
        return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
      }
      if (parsed.pathname.startsWith("/embed/")) {
        return `https://www.youtube-nocookie.com${parsed.pathname}`;
      }
    }
    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
};

const ScoreBanner = ({ meta }: { meta?: MatchMetadata | null }) => {
  if (!shouldShowScoreCard(meta) || !meta) return null;

  const homeLogo = logoForTeam(meta.home_team ?? undefined);
  const awayLogo = logoForTeam(meta.away_team ?? undefined);
  const scoreText = meta.score?.trim() ?? "";
  const [homeScore, awayScore] = scoreText.includes("-")
    ? scoreText.split("-").map((s) => s.trim())
    : [null, null];
  const scheduled = meta.evidence_status === "scheduled";
  const goals = meta.key_moments.filter((m) => m.event.toUpperCase() === "GOAL");
  const homeGoals = goals.filter((g) => g.team === "home");
  const awayGoals = goals.filter((g) => g.team === "away");

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-white/10 bg-[#121212] shadow-2xl">
      <div className="flex items-center justify-between bg-[#1a1a1a] px-6 py-3 text-xs font-medium text-white/60">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚽</span>
          {meta.competition ? <span>{meta.competition}</span> : null}
        </div>
        <div className="flex items-center gap-4">
          {meta.match_date ? <span>{meta.match_date}</span> : null}
        </div>
      </div>

      <div className="relative flex flex-col items-center justify-center gap-8 px-6 py-8 sm:flex-row sm:gap-16">
        <div className="flex flex-col items-center gap-3 text-center flex-1">
          {homeLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={homeLogo}
              alt={meta.home_team ?? "Home"}
              className="h-20 w-20 object-contain"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-2xl font-bold text-white">
              {meta.home_team?.slice(0, 2) || "H"}
            </div>
          )}
          <div className="space-y-1">
             {meta.home_team ? <p className="text-lg font-bold text-white">{meta.home_team}</p> : null}
             <div className="text-xs text-white/50 space-y-0.5">
                {homeGoals.map((g, i) => (
                    <p key={i}>{g.minute ? `${g.minute}' ` : ""}{g.description}</p>
                ))}
             </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          {scheduled ? (
            <div className="text-sm font-medium uppercase tracking-widest text-white/50">
              Scheduled
            </div>
          ) : (
            <div className="flex items-center gap-4 text-5xl font-bold text-white tracking-tighter">
              <span>{homeScore}</span>
              <span className="text-white/20">-</span>
              <span>{awayScore}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 text-center flex-1">
          {awayLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={awayLogo}
              alt={meta.away_team ?? "Away"}
              className="h-20 w-20 object-contain"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-2xl font-bold text-white">
              {meta.away_team?.slice(0, 2) || "A"}
            </div>
          )}
          <div className="space-y-1">
             {meta.away_team ? <p className="text-lg font-bold text-white">{meta.away_team}</p> : null}
             <div className="text-xs text-white/50 space-y-0.5">
                {awayGoals.map((g, i) => (
                    <p key={i}>{g.minute ? `${g.minute}' ` : ""}{g.description}</p>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [includeHighlights, setIncludeHighlights] = useState(true);
  const [emphasizeOrder, setEmphasizeOrder] = useState(true);
  const [onCooldown, setOnCooldown] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    result: apiData,
    thinking,
    error: queryError,
    loading,
    streamActive,
    requestId,
    runQuery,
    reset,
  } = useSoccerQuery();
  const error = formError ?? queryError;
  const resultsRef = useRef<HTMLDivElement>(null);
  const thinkingSectionRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const thinkingScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (thinkingScrollRef.current) {
      thinkingScrollRef.current.scrollTop = thinkingScrollRef.current.scrollHeight;
    }
  }, [thinking]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (onCooldown) {
      setFormError("Please wait a few seconds before trying again.");
      return;
    }
    setFormError(null);

    setTimeout(() => {
      thinkingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);

    setOnCooldown(true);
    setTimeout(() => setOnCooldown(false), 6000);

    await runQuery({
      query: query.trim(),
      include_highlights: includeHighlights,
      emphasize_order: emphasizeOrder,
      gender: "men",
    });
  };

  const highlightCards: HighlightVideo[] = useMemo(
    () => apiData?.highlights ?? [],
    [apiData],
  );

  const primaryHighlight = useMemo(() => {
    return highlightCards.find((h) => h.url) || null;
  }, [highlightCards]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050505] font-sans text-white selection:bg-indigo-500/30">
      {/* Header */}
      <header className="absolute left-0 right-0 top-0 z-50 flex items-center justify-between px-6 py-6 md:px-12">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500">
            <span className="text-sm">⚽</span>
          </div>
          <span className="font-semibold tracking-tight text-white">SoccerAI</span>
        </div>
        <nav className="hidden items-center gap-8 text-sm font-medium text-white/60 md:flex">
          <a href="#" className="text-white">Home</a>
          <a href="https://www.phil.chat" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Contact</a>
        </nav>
        <a href="#query-input" className="rounded-full bg-white/10 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20">
          Get Started
        </a>
      </header>

      {/* Hero Section */}
      <main className="relative flex min-h-screen flex-col items-center justify-center px-4 pt-32 pb-20">
        {/* Background Elements */}
        <div className="absolute left-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute top-0 -z-10 h-full w-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
        
        {/* Mo Salah Image - Background behind hero text */}
        <div className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none w-full max-w-6xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mosalah.png"
            alt="Mo Salah"
            className="h-[1000px] w-auto mx-auto object-contain opacity-[0.25]"
          />
        </div>

        <div className="relative z-10 flex max-w-4xl flex-col items-center text-center">
          <h1 className="font-serif text-5xl font-medium leading-tight tracking-tight text-white md:text-7xl">
            Your AI-Powered <br />
            <span className="text-white/90">Soccer Analyst</span>
          </h1>
          
          <p className="mt-6 max-w-2xl text-lg text-white/60">
            Ask about matches, scores, highlights, tactical breakdowns, and comprehensive analysis powered by AI.
          </p>

          <div id="query-input" className="mt-10 w-full max-w-xl scroll-mt-32">
            <form 
              onSubmit={handleSubmit}
              ref={formRef}
              className="relative flex items-center rounded-full border border-white/10 bg-white/5 p-2 shadow-2xl backdrop-blur-sm transition-all focus-within:border-white/20 focus-within:bg-white/10"
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about matches, team news, lineups, or tactics..."
                className="flex-1 bg-transparent px-6 py-3 text-base text-white placeholder-white/40 outline-none"
                required
              />
              <button
                type="submit"
                disabled={
                  loading ||
                  !query.trim() ||
                  onCooldown ||
                  streamActive
                }
                className="rounded-full bg-gradient-to-r from-[#a78bfa] to-[#818cf8] px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/40 disabled:opacity-70"
              >
                {loading ? "Getting Insights..." : "Get Insights"}
              </button>
            </form>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-white/40">
              <label className="flex cursor-pointer items-center gap-2 transition-colors hover:text-white/60">
                <input
                  type="checkbox"
                  className="accent-indigo-500"
                  checked={includeHighlights}
                  onChange={(e) => setIncludeHighlights(e.target.checked)}
                />
                Include highlights
              </label>
              <label className="flex cursor-pointer items-center gap-2 transition-colors hover:text-white/60">
                <button
                  type="button"
                  onClick={() => setEmphasizeOrder(!emphasizeOrder)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${emphasizeOrder ? "bg-indigo-500" : "bg-white/20"}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${emphasizeOrder ? "translate-x-4" : "translate-x-0"}`}
                  />
                </button>
                Preserve team order
              </label>
              {error && (
                error.toLowerCase().includes('memory') ? (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
                    <span className="text-amber-400 text-xs">⚠️ Memory usage exceeded. Try a simpler query.</span>
                  </div>
                ) : (
                  <span className="text-rose-400">• {error}</span>
                )
              )}
            </div>
            <p className="mt-3 text-center text-[10px] text-white/30">
              AI may make mistakes. Please verify important information.
            </p>

            {/* Compact Thinking Stream under Prompt - REMOVED since moving to Hero */}
          </div>
        </div>

          <div ref={thinkingSectionRef} className="relative mt-10 flex w-full max-w-5xl flex-col items-center justify-center gap-12 lg:flex-row">
            {/* Thinking Chatbox - Now in Hero */}
            {(thinking.length > 0 || loading || apiData) ? (
              <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0c0e14]/80 backdrop-blur-xl shadow-2xl">
                    <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-2.5 w-2.5">
                          <span className={`inline-flex h-full w-full rounded-full ${streamActive ? "bg-emerald-400 animate-pulse" : "bg-white/20"}`} />
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Live Analyst</span>
                      </div>
                      <span className="text-[10px] font-medium text-white/40">AI Model</span>
                    </div>
                    
                    <div 
                      ref={thinkingScrollRef}
                      className="h-[400px] space-y-4 overflow-y-auto p-6 custom-scrollbar scroll-smooth"
                    >
                      {thinking.length === 0 && loading && (
                        <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-white/30">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-indigo-500" />
                          <p className="text-sm">Connecting to match engine...</p>
                        </div>
                      )}

                      {thinking.map((item, idx) => (
                        <div key={idx} className="flex gap-4 animate-in fade-in slide-in-from-left-2 duration-300 group">
                          <div className={`mt-1 h-6 w-6 rounded-full flex items-center justify-center text-[10px] shrink-0 border border-white/5 shadow-sm transition-colors ${
                             item.status === 'complete' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                             item.status === 'processing' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                             'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                          }`}>
                            {item.status === 'complete' ? '✓' : '•'}
                          </div>
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 group-hover:text-white/60 transition-colors">{item.stage}</p>
                            <p className="text-sm leading-relaxed text-white/90 break-words">{item.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>
              </div>
            ) : (
              // Default "Chat" Placeholder (Static Bubbles) when idle
              <div className="relative w-full max-w-md h-[260px]">
                  {/* User question - top right */}
                  <div className="absolute top-0 right-0 z-20 animate-[float_5s_ease-in-out_infinite_1s] rounded-2xl border border-white/10 bg-[#1a1b26]/90 p-4 shadow-xl backdrop-blur-md">
                    <div className="flex items-center gap-3">
                       <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600/30 text-xs">⚽</div>
                      <div>
                        <p className="text-xs font-medium text-white">You</p>
                        <p className="text-xs text-white/60">Who won the Premier League 24/25?</p>
                      </div>
                    </div>
                  </div>

                 {/* AI response - below left */}
                 <div className="absolute top-20 left-0 z-20 animate-[float_4s_ease-in-out_infinite] rounded-2xl border border-white/10 bg-[#1a1b26]/90 p-4 shadow-xl backdrop-blur-md max-w-[280px]">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-lg">🤖</div>
                      <div>
                        <p className="text-xs font-medium text-white">Soccer Analyst</p>
                        <p className="text-xs text-white/60 leading-relaxed">Liverpool won the 24/25 Premier League under Arne Slot!</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Status badge - bottom center */}
                  <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 animate-[float_6s_ease-in-out_infinite_0.5s] rounded-full border border-white/10 bg-[#1a1b26] px-6 py-3 shadow-xl backdrop-blur-md">
                    <p className="text-sm text-white">🏆 Champions crowned</p>
                  </div>
              </div>
            )}
          </div>

        {/* Results Section - appears below or when needed */}
        <div ref={resultsRef} className="mt-24 w-full max-w-6xl scroll-mt-24">
          {(streamActive || apiData || thinking.length > 0) && (
            apiData?.success === false && apiData.error !== "no_match_found" ? (
               <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-[#0c0e14]/80 p-12 text-center backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 mb-6">
                    <span className="text-3xl">⚠️</span>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Something unexpected happened</h3>
                  <p className="text-white/60 max-w-md mb-8">
                    {error || apiData.summary || "We couldn't process your request completely. Please try asking your question differently or check back later."}
                  </p>
                  {requestId ? (
                    <p className="mb-6 text-[10px] text-white/40">Request {requestId}</p>
                  ) : null}
                  <button
                    onClick={() => {
                       reset();
                       setQuery("");
                       window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="rounded-full bg-white/10 px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-white/20"
                  >
                    Try Another Query
                  </button>
               </div>
            ) : (
            <div className="rounded-3xl border border-white/10 bg-[#0c0e14]/80 p-6 backdrop-blur-xl">
              <ScoreBanner meta={apiData?.match_metadata} />

              {apiData &&
                isMatchOrientedIntent(apiData.intent) &&
                (apiData.error === "no_match_found" ||
                  apiData.match_metadata?.no_match_found ||
                  apiData.match_metadata?.evidence_status === "insufficient" ||
                  apiData.match_metadata?.evidence_status === "conflicting") && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                  {apiData.match_metadata?.evidence_status === "conflicting"
                    ? "Sources disagree on this match. The API could not verify a single result."
                    : apiData.match_metadata?.evidence_status === "insufficient"
                      ? "There is not enough verified evidence for a match result."
                      : "No verified match was found for that query."}
                  {requestId ? (
                    <p className="mt-2 text-[10px] text-white/40">Request {requestId}</p>
                  ) : null}
                </div>
              )}

              <div className={`space-y-4 ${apiData?.match_metadata?.score ? "mt-6" : ""}`}>
                <h3 className="text-lg font-medium text-white">Analysis</h3>
                {requestId ? (
                  <p className="text-[10px] text-white/30">Request {requestId}</p>
                ) : null}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-inner">
                    <div className="text-white/90 leading-relaxed markdown-content">
                        {apiData?.summary ? (
                            <ReactMarkdown>
                                {apiData.summary}
                            </ReactMarkdown>
                        ) : (
                            loading ? "Generating comprehensive analysis..." : "Analysis will appear here."
                        )}
                    </div>

                    {apiData?.sources?.length ? (
                        <div className="mt-6 border-t border-white/10 pt-4">
                            <div className="flex flex-wrap gap-2">
                            {apiData.sources.map((src: SourceCitation) => {
                                const href = httpsHref(src.url);
                                if (!href) return null;
                                const label = src.title || src.domain || src.url;
                                const faviconHost = src.domain || (() => {
                                  try {
                                    return new URL(href).hostname;
                                  } catch {
                                    return null;
                                  }
                                })();
                                return (
                                <a
                                    key={src.id}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:border-white/20 transition-all"
                                >
                                    {faviconHost ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                    src={`https://www.google.com/s2/favicons?domain=${faviconHost}&sz=32`}
                                    alt=""
                                    className="h-4 w-4 rounded-sm opacity-80"
                                    />
                                    ) : null}
                                    <span>{label}</span>
                                </a>
                                );
                            })}
                            </div>
                        </div>
                    ) : null}
                        {!loading && !streamActive && (
                          <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-white/50">Not what you expected?</p>
                            <button
                              type="button"
                              disabled={loading || streamActive}
                              onClick={() => {
                                if (!loading && !streamActive) formRef.current?.requestSubmit();
                              }}
                              className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white transition-colors ${loading || streamActive ? "cursor-not-allowed opacity-60" : "hover:border-white/30 hover:bg-white/10"}`}
                            >
                              Try again with the same query
                            </button>
                          </div>
                        )}
                </div>
              </div>

              {highlightCards.length > 0 ? (
              <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
                <h4 className="mb-4 text-sm font-medium uppercase tracking-wider text-white/60">Highlights</h4>
                {primaryHighlight && youtubeEmbedUrl(primaryHighlight.url) ? (
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
                    <iframe
                      title={primaryHighlight.title}
                      src={youtubeEmbedUrl(primaryHighlight.url) ?? undefined}
                      className="aspect-video w-full"
                      allowFullScreen
                    />
                  </div>
                ) : primaryHighlight && httpsHref(primaryHighlight.url) ? (
                  <a
                    href={httpsHref(primaryHighlight.url) ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-400 hover:underline"
                  >
                    {primaryHighlight.title}
                  </a>
                ) : null}
                
                {highlightCards.length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {highlightCards.slice(primaryHighlight ? 1 : 0).map((h) => {
                      const href = httpsHref(h.url);
                      if (!href) return null;
                      return (
                      <a key={h.url} href={href} target="_blank" rel="noopener noreferrer" className="inline-block truncate max-w-xs text-xs text-indigo-400 hover:underline">
                        {h.title}
                      </a>
                      );
                    })}
                  </div>
                )}
              </div>
              ) : null}

              {/* Deep Analysis */}
              <div className="mt-8 space-y-6">
                  {/* Final Response REMOVED - Moved up */}
                  
                  {/* Sources moved here */}


                  {/* Deep Analysis */}
                  {typeof apiData?.game_analysis?.deep_analysis === "string" &&
                    apiData.game_analysis.deep_analysis && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-white">Tactical Breakdown</h3>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/80 leading-relaxed markdown-content">
                        <ReactMarkdown>
                            {apiData.game_analysis.deep_analysis}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
              </div>
            </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}

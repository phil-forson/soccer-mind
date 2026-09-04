export type Gender = "men" | "women" | "any";

export type QueryRequest = {
  query: string;
  include_highlights?: boolean | null;
  emphasize_order?: boolean;
  gender?: Gender;
};

export type ClaimEvidenceStatus = "supported" | "conflicting" | "insufficient";

export type ClaimEvidence = {
  claim: string;
  evidence_chunk_ids: string[];
  confidence: number;
  status: ClaimEvidenceStatus;
};

export type EvidenceStatus =
  | "finished"
  | "scheduled"
  | "insufficient"
  | "conflicting"
  | "live"
  | "unknown";

export type KeyMoment = {
  minute: string | null;
  event: string;
  description: string;
  team: string | null;
};

export type MatchMetadata = {
  home_team: string | null;
  away_team: string | null;
  match_date: string | null;
  score: string | null;
  competition: string | null;
  key_moments: KeyMoment[];
  man_of_the_match: string | null;
  match_summary: string | null;
  evidence_status: EvidenceStatus | null;
  claim_evidence: ClaimEvidence[];
  no_match_found: boolean | null;
};

export type SourceCitation = {
  id: string;
  url: string;
  title: string | null;
  domain: string | null;
};

export type HighlightVideo = {
  title: string;
  url: string;
  duration: string | null;
  source_type: string | null;
  is_nbc_sports: boolean;
  is_official_club: boolean;
  confidence: number | null;
};

export type QueryResponse = {
  success: boolean;
  request_id: string;
  intent: string;
  summary: string;
  match_metadata: MatchMetadata | null;
  highlights: HighlightVideo[];
  sources: SourceCitation[];
  game_analysis: Record<string, unknown> | null;
  error: string | null;
};

export type ThinkingMessage = {
  stage: string;
  message: string;
  status: string;
  data: Record<string, unknown> | null;
};

export type MomentumShift = {
  minute: string;
  event: string;
  description: string;
  team: string | null;
  momentum_impact: string;
  reasoning: string;
};

export type GameAnalysisResponse = {
  success: boolean;
  request_id: string;
  match_info: Record<string, unknown> | null;
  deep_analysis: string | null;
  momentum_analysis: MomentumShift[];
  tactical_analysis: Record<string, unknown> | null;
  key_moments: KeyMoment[];
  highlights: HighlightVideo[];
  error: string | null;
};

export type HealthResponse = {
  status: string;
  version: string;
};

/** Match-oriented intents from soccer-llm-analyst `QueryIntent` / `MATCH_INTENTS`. */
export const MATCH_INTENTS = new Set([
  "match_result",
  "match_highlights",
  "lineup",
  "stats",
]);

export function isMatchOrientedIntent(intent: string): boolean {
  return MATCH_INTENTS.has(intent);
}

export function shouldShowScoreCard(meta: MatchMetadata | null | undefined): boolean {
  if (!meta || meta.no_match_found) return false;
  if (meta.evidence_status === "insufficient" || meta.evidence_status === "conflicting") {
    return false;
  }
  if (meta.evidence_status === "scheduled") {
    return Boolean(meta.home_team && meta.away_team && meta.match_date);
  }
  if (meta.evidence_status !== "finished") return false;
  const score = meta.score?.trim();
  return Boolean(score && score !== "–" && score !== "-");
}

import type {
  ClaimEvidence,
  ClaimEvidenceStatus,
  EvidenceStatus,
  HighlightVideo,
  KeyMoment,
  MatchMetadata,
  QueryResponse,
  SourceCitation,
  ThinkingMessage,
} from "./types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const EVIDENCE_STATUSES = new Set<EvidenceStatus>([
  "finished",
  "scheduled",
  "insufficient",
  "conflicting",
  "live",
  "unknown",
]);

const CLAIM_STATUSES = new Set<ClaimEvidenceStatus>([
  "supported",
  "conflicting",
  "insufficient",
]);

export function parseKeyMoment(value: unknown): KeyMoment | null {
  if (!isRecord(value)) return null;
  const event = asString(value.event);
  const description = asString(value.description);
  if (!event || description === null) return null;
  return {
    minute: asString(value.minute),
    event,
    description,
    team: asString(value.team),
  };
}

export function parseClaimEvidence(value: unknown): ClaimEvidence | null {
  if (!isRecord(value)) return null;
  const claim = asString(value.claim);
  if (!claim) return null;
  const statusRaw = asString(value.status);
  const status: ClaimEvidenceStatus =
    statusRaw && CLAIM_STATUSES.has(statusRaw as ClaimEvidenceStatus)
      ? (statusRaw as ClaimEvidenceStatus)
      : "insufficient";
  const ids = Array.isArray(value.evidence_chunk_ids)
    ? value.evidence_chunk_ids.filter((id): id is string => typeof id === "string")
    : [];
  return {
    claim,
    evidence_chunk_ids: ids,
    confidence: asNumber(value.confidence) ?? 0,
    status,
  };
}

export function parseSourceCitation(value: unknown): SourceCitation | null {
  if (!isRecord(value)) return null;
  const id = asString(value.id);
  const url = asString(value.url);
  if (!id || !url) return null;
  return {
    id,
    url,
    title: asString(value.title),
    domain: asString(value.domain),
  };
}

export function parseHighlightVideo(value: unknown): HighlightVideo | null {
  if (!isRecord(value)) return null;
  const title = asString(value.title);
  const url = asString(value.url);
  if (!title || !url) return null;
  return {
    title,
    url,
    duration: asString(value.duration),
    source_type: asString(value.source_type),
    is_nbc_sports: asBoolean(value.is_nbc_sports) ?? false,
    is_official_club: asBoolean(value.is_official_club) ?? false,
    confidence: asNumber(value.confidence),
  };
}

export function parseMatchMetadata(value: unknown): MatchMetadata | null {
  if (value == null) return null;
  if (!isRecord(value)) return null;
  const statusRaw = asString(value.evidence_status);
  const evidence_status =
    statusRaw && EVIDENCE_STATUSES.has(statusRaw as EvidenceStatus)
      ? (statusRaw as EvidenceStatus)
      : null;
  return {
    home_team: asString(value.home_team),
    away_team: asString(value.away_team),
    match_date: asString(value.match_date),
    score: asString(value.score),
    competition: asString(value.competition),
    key_moments: Array.isArray(value.key_moments)
      ? value.key_moments.flatMap((item) => {
          const moment = parseKeyMoment(item);
          return moment ? [moment] : [];
        })
      : [],
    man_of_the_match: asString(value.man_of_the_match),
    match_summary: asString(value.match_summary),
    evidence_status,
    claim_evidence: Array.isArray(value.claim_evidence)
      ? value.claim_evidence.flatMap((item) => {
          const claim = parseClaimEvidence(item);
          return claim ? [claim] : [];
        })
      : [],
    no_match_found: asBoolean(value.no_match_found),
  };
}

export function parseQueryResponse(value: unknown): QueryResponse | null {
  if (!isRecord(value)) return null;
  if (typeof value.success !== "boolean") return null;
  const request_id = asString(value.request_id);
  const intent = asString(value.intent);
  const summary = asString(value.summary);
  if (!request_id || intent === null || summary === null) return null;

  const sources = Array.isArray(value.sources)
    ? value.sources.flatMap((item) => {
        const source = parseSourceCitation(item);
        return source ? [source] : [];
      })
    : [];

  const highlights = Array.isArray(value.highlights)
    ? value.highlights.flatMap((item) => {
        const highlight = parseHighlightVideo(item);
        return highlight ? [highlight] : [];
      })
    : [];

  return {
    success: value.success,
    request_id,
    intent,
    summary,
    match_metadata: parseMatchMetadata(value.match_metadata),
    highlights,
    sources,
    game_analysis: isRecord(value.game_analysis) ? value.game_analysis : null,
    error: asString(value.error),
  };
}

export function parseThinkingMessage(value: unknown): ThinkingMessage | null {
  if (!isRecord(value)) return null;
  const stage = asString(value.stage);
  const message = asString(value.message);
  const status = asString(value.status);
  if (!stage || message === null || !status) return null;
  return {
    stage,
    message,
    status,
    data: isRecord(value.data) ? value.data : null,
  };
}

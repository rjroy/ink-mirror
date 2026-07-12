/**
 * Client-side API client. Calls Next.js API routes which proxy to the daemon.
 * Used by React client components in the browser.
 */

import type {
  Entry,
  EntryListItem,
  Profile,
  ProfileRule,
  NudgeResponse,
  Pattern,
  PatternStatus,
  Dossier,
  PatternCurationSession,
  PatternProposal,
  ObservationCreatedEvent,
  PatternDiscoveredEvent,
  PatternProposalEvent,
  PatternWatchResolvedEvent,
} from "@ink-mirror/shared";

async function fetchApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function createEntry(body: string, title?: string): Promise<Entry> {
  return fetchApi<Entry>("/entries", {
    method: "POST",
    body: JSON.stringify({ body, title }),
  });
}

export async function listEntries(): Promise<EntryListItem[]> {
  return fetchApi<EntryListItem[]>("/entries");
}

// --- Pattern-grain curation API (REQ-LPC-28) ---
//
// Observation-grain classifyObservation is gone: the endpoint it called
// (PATCH /observations/:id) was removed from the daemon in Phase 4.
// Curation now judges whole pattern dossiers, not single observations.

export async function getPatternSession(): Promise<
  PatternCurationSession & { proposals: PatternProposal[] }
> {
  return fetchApi<PatternCurationSession & { proposals: PatternProposal[] }>(
    "/patterns/session",
  );
}

export async function listPatterns(status?: PatternStatus): Promise<Pattern[]> {
  const path = status ? `/patterns?status=${status}` : "/patterns";
  return fetchApi<Pattern[]>(path);
}

export async function getPattern(id: string): Promise<Dossier> {
  return fetchApi<Dossier>(`/patterns/${id}`);
}

export async function classifyPattern(
  id: string,
  status: "intentional" | "accidental" | "undecided",
  promote?: boolean,
): Promise<Pattern & { rule?: ProfileRule }> {
  return fetchApi<Pattern & { rule?: ProfileRule }>(`/patterns/${id}/classify`, {
    method: "POST",
    body: JSON.stringify(promote ? { status, promote } : { status }),
  });
}

export async function promotePattern(id: string): Promise<Pattern & { rule: ProfileRule }> {
  return fetchApi<Pattern & { rule: ProfileRule }>(`/patterns/${id}/promote`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function respondToProposal(
  id: string,
  action: "accept" | "decline",
): Promise<Pattern & { rule?: ProfileRule }> {
  return fetchApi<Pattern & { rule?: ProfileRule }>(`/patterns/${id}/proposal`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export async function detachSighting(
  id: string,
  sightingId: string,
): Promise<{ source: Pattern; newPattern: Pattern }> {
  return fetchApi<{ source: Pattern; newPattern: Pattern }>(`/patterns/${id}/detach`, {
    method: "POST",
    body: JSON.stringify({ sightingId }),
  });
}

export async function mergePatterns(id: string, duplicateId: string): Promise<Pattern> {
  return fetchApi<Pattern>(`/patterns/${id}/merge`, {
    method: "POST",
    body: JSON.stringify({ duplicateId }),
  });
}

export async function dismissPattern(id: string): Promise<Pattern> {
  return fetchApi<Pattern>(`/patterns/${id}/dismiss`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function retirePattern(id: string): Promise<Pattern> {
  return fetchApi<Pattern>(`/patterns/${id}/retire`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function reactivatePattern(id: string): Promise<Pattern> {
  return fetchApi<Pattern>(`/patterns/${id}/reactivate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function reaffirmRule(patternId: string): Promise<ProfileRule> {
  return fetchApi<ProfileRule>(`/patterns/${patternId}/reaffirm`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getWatchList(): Promise<{ watchList: Dossier[] }> {
  return fetchApi<{ watchList: Dossier[] }>("/patterns/watch");
}

// --- Profile ---

export async function getProfile(): Promise<Profile & { markdown: string }> {
  return fetchApi<Profile & { markdown: string }>("/profile");
}

export async function updateProfileRule(
  id: string,
  updates: { pattern?: string; dimension?: string },
): Promise<ProfileRule> {
  return fetchApi<ProfileRule>(`/profile/rules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteProfileRule(id: string): Promise<void> {
  await fetchApi<{ ok: boolean }>(`/profile/rules/${id}`, {
    method: "DELETE",
  });
}

export async function replaceProfile(markdown: string): Promise<Profile> {
  return fetchApi<Profile>("/profile", {
    method: "PUT",
    body: JSON.stringify({ markdown }),
  });
}

export async function requestNudge(
  params: {
    text?: string;
    entryId?: string;
    context?: string;
    refresh?: boolean;
  },
  options: { signal?: AbortSignal } = {},
): Promise<NudgeResponse> {
  return fetchApi<NudgeResponse>("/nudge", {
    method: "POST",
    body: JSON.stringify(params),
    signal: options.signal,
  });
}

/**
 * Handlers for the versioned SSE event contract (REQ-LPC-29). Every handler
 * is optional: callers subscribe only to the events they care about, so a
 * component that just wants to know an entry produced a sighting doesn't
 * have to also branch on pattern-discovery/proposal/watch-resolution
 * payloads it has no use for.
 *
 * `onPatternDiscovered` is wired today: journal-editor.tsx uses it inside its
 * existing submission-scoped SSE window (see DiscoveredPatterns there).
 *
 * `onPatternProposal` and `onPatternWatchResolved` are intentionally
 * unwired right now. Both events fire during curation-session assembly
 * (`GET /patterns/session`, `GET /patterns/watch` in the daemon's
 * routes/patterns.ts), which has no relationship to entry submission — there
 * is no SSE connection open during curation today. curation-panel.tsx
 * already gets this same data fresher, on every load, via the direct fetch
 * response (PatternCurationSession.proposals / getWatchList), so there is no
 * live-push consumer surface for these two events yet. Opening a
 * curation-panel SSE subscription just to carry them would mean holding a
 * connection open for the panel's whole open-ended review session, which is
 * exactly the "opens on mount, holds forever" anti-pattern this project's
 * SSE-scoping lesson (CLAUDE.md) warns against — curation has no natural
 * request-scoped window the way entry submission does. These two handler
 * slots exist for a future feature (near-real-time updates across multiple
 * open tabs/sessions), not a current gap; wiring them here today would be
 * scope creep, not a fix.
 */
export interface PatternEventHandlers {
  onObservation?: (observation: ObservationCreatedEvent) => void;
  onPatternDiscovered?: (event: PatternDiscoveredEvent) => void;
  onPatternProposal?: (event: PatternProposalEvent) => void;
  onPatternWatchResolved?: (event: PatternWatchResolvedEvent) => void;
  onError?: (error: Event) => void;
}

/**
 * Subscribe to observation/pattern events via SSE (REQ-LPC-29's versioned
 * contract). Returns a cleanup function to close the connection.
 *
 * Per this project's SSE-scoping lesson (CLAUDE.md): callers should open
 * this only for the duration they need it (e.g. around an entry submission)
 * and call the returned cleanup as soon as they're done, not hold it open
 * for a component's whole mounted lifetime.
 */
export function subscribeObservations(handlers: PatternEventHandlers): () => void {
  const source = new EventSource("/api/events/observations");

  if (handlers.onObservation) {
    const onObservation = handlers.onObservation;
    source.addEventListener("observation", (event: MessageEvent<string>) => {
      onObservation(JSON.parse(event.data) as ObservationCreatedEvent);
    });
  }

  if (handlers.onPatternDiscovered) {
    const onPatternDiscovered = handlers.onPatternDiscovered;
    source.addEventListener("pattern:discovered", (event: MessageEvent<string>) => {
      onPatternDiscovered(JSON.parse(event.data) as PatternDiscoveredEvent);
    });
  }

  if (handlers.onPatternProposal) {
    const onPatternProposal = handlers.onPatternProposal;
    source.addEventListener("pattern:proposal", (event: MessageEvent<string>) => {
      onPatternProposal(JSON.parse(event.data) as PatternProposalEvent);
    });
  }

  if (handlers.onPatternWatchResolved) {
    const onPatternWatchResolved = handlers.onPatternWatchResolved;
    source.addEventListener("pattern:watch-resolved", (event: MessageEvent<string>) => {
      onPatternWatchResolved(JSON.parse(event.data) as PatternWatchResolvedEvent);
    });
  }

  if (handlers.onError) {
    source.onerror = handlers.onError;
  }

  return () => source.close();
}

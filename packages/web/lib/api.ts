/**
 * Client-side API client. Calls Next.js API routes which proxy to the daemon.
 * Used by React client components in the browser.
 */

import type {
  Entry,
  EntryListItem,
  Observation,
  CurationSession,
  Profile,
  ProfileRule,
  NudgeResponse,
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

export async function getCurationSession(): Promise<CurationSession> {
  return fetchApi<CurationSession>("/observations/pending");
}

export async function classifyObservation(
  id: string,
  status: "intentional" | "accidental" | "undecided",
): Promise<Observation & { profileUpdated: boolean }> {
  return fetchApi<Observation & { profileUpdated: boolean }>(
    `/observations/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}

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

export async function requestNudge(params: {
  text?: string;
  entryId?: string;
  context?: string;
}): Promise<NudgeResponse> {
  return fetchApi<NudgeResponse>("/nudge", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * Subscribe to observation events via SSE.
 * Returns a cleanup function to close the connection.
 */
export function subscribeObservations(
  onObservation: (observation: Observation) => void,
  onError?: (error: Event) => void,
): () => void {
  const source = new EventSource("/api/events/observations");

  source.addEventListener("observation", (event) => {
    const observation = JSON.parse(event.data) as Observation;
    onObservation(observation);
  });

  if (onError) {
    source.onerror = onError;
  }

  return () => source.close();
}

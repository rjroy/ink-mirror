/**
 * Client-side API client. Calls Next.js API routes which proxy to the daemon.
 * Used by React client components in the browser.
 */
import type { Entry, EntryListItem, Observation, CurationSession, Profile, ProfileRule } from "@ink-mirror/shared";
export declare function createEntry(body: string, title?: string): Promise<Entry>;
export declare function listEntries(): Promise<EntryListItem[]>;
export declare function getEntry(id: string): Promise<Entry>;
export declare function getCurationSession(): Promise<CurationSession>;
export declare function classifyObservation(id: string, status: "intentional" | "accidental" | "undecided"): Promise<Observation & {
    profileUpdated: boolean;
}>;
export declare function getProfile(): Promise<Profile & {
    markdown: string;
}>;
export declare function updateProfileRule(id: string, updates: {
    pattern?: string;
    dimension?: string;
}): Promise<ProfileRule>;
export declare function deleteProfileRule(id: string): Promise<void>;
export declare function replaceProfile(markdown: string): Promise<Profile>;
/**
 * Subscribe to observation events via SSE.
 * Returns a cleanup function to close the connection.
 */
export declare function subscribeObservations(onObservation: (observation: Observation) => void, onError?: (error: Event) => void): () => void;
//# sourceMappingURL=api.d.ts.map
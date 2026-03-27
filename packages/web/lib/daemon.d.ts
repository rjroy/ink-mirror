/**
 * Server-side daemon client. Talks to the daemon over Unix socket.
 * Used by Next.js server components and API route handlers.
 *
 * The web client is a view (REQ-V1-24). All data flows through
 * the daemon API. No direct file or LLM calls.
 */
export interface DaemonFetchOptions {
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
}
/**
 * Fetch from the daemon via Unix socket.
 * Returns the raw Response for callers that need streaming (SSE).
 */
export declare function daemonFetch(path: string, options?: DaemonFetchOptions): Promise<Response>;
/**
 * Fetch JSON from the daemon. Throws on non-OK responses.
 */
export declare function daemonJson<T>(path: string, options?: DaemonFetchOptions): Promise<T>;
//# sourceMappingURL=daemon.d.ts.map
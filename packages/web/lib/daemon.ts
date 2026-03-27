/**
 * Server-side daemon client. Talks to the daemon over Unix socket.
 * Used by Next.js server components and API route handlers.
 *
 * The web client is a view (REQ-V1-24). All data flows through
 * the daemon API. No direct file or LLM calls.
 */

const SOCKET_PATH = process.env.INK_MIRROR_SOCKET ?? "/tmp/ink-mirror.sock";

export interface DaemonFetchOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Fetch from the daemon via Unix socket.
 * Returns the raw Response for callers that need streaming (SSE).
 */
export async function daemonFetch(
  path: string,
  options: DaemonFetchOptions = {},
): Promise<Response> {
  const { method = "GET", body, signal } = options;

  const init: RequestInit & { unix: string } = {
    method,
    unix: SOCKET_PATH,
    signal,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  return fetch(`http://localhost${path}`, init);
}

/**
 * Fetch JSON from the daemon. Throws on non-OK responses.
 */
export async function daemonJson<T>(
  path: string,
  options: DaemonFetchOptions = {},
): Promise<T> {
  const response = await daemonFetch(path, options);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Daemon error ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

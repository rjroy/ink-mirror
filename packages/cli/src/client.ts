import type { HelpTreeNode } from "@ink-mirror/shared";

/**
 * HTTP client for communicating with the daemon over Unix socket.
 * All daemon communication goes through this interface.
 */
export interface DaemonClient {
  fetch(path: string, init?: RequestInit): Promise<Response>;
  fetchJson<T>(path: string, init?: RequestInit): Promise<T>;
  getHelpTree(path?: string[]): Promise<HelpTreeNode>;
}

export function createDaemonClient(socketPath: string): DaemonClient {
  // Bun supports Unix socket fetch with the unix option
  async function daemonFetch(
    path: string,
    init?: RequestInit,
  ): Promise<Response> {
    const url = `http://localhost${path}`;
    return fetch(url, {
      ...init,
      unix: socketPath,
    } as RequestInit);
  }

  return {
    fetch: daemonFetch,

    async fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
      const res = await daemonFetch(path, init);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Daemon error ${res.status}: ${body}`);
      }
      return (await res.json()) as T;
    },

    async getHelpTree(path?: string[]): Promise<HelpTreeNode> {
      const helpPath = path?.length ? `/help/${path.join("/")}` : "/help";
      return this.fetchJson<HelpTreeNode>(helpPath);
    },
  };
}

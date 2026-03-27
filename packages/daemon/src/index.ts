import { createApp } from "./app.js";

const SOCKET_PATH = process.env.INK_MIRROR_SOCKET ?? "/tmp/ink-mirror.sock";

const { hono } = createApp();

// Clean up stale socket file
try {
  const { unlinkSync } = await import("node:fs");
  unlinkSync(SOCKET_PATH);
} catch {
  // Socket doesn't exist yet, that's fine
}

const server = Bun.serve({
  unix: SOCKET_PATH,
  fetch: hono.fetch,
  // Disable idle timeout for long-lived SSE connections
  idleTimeout: 0,
});

console.log(`ink-mirror daemon listening on ${server.url}`);

export { server };

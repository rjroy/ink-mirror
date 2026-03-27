import { join } from "node:path";
import { createApp } from "./app.js";
import { createEntryStore } from "./entry-store.js";
import { createEntryRoutes } from "./routes/entries.js";

const SOCKET_PATH = process.env.INK_MIRROR_SOCKET ?? "/tmp/ink-mirror.sock";
const DATA_DIR = process.env.INK_MIRROR_DATA ?? join(process.env.HOME ?? ".", ".ink-mirror");
const ENTRIES_DIR = join(DATA_DIR, "entries");

const entryStore = createEntryStore({ entriesDir: ENTRIES_DIR });
const entryRoutes = createEntryRoutes({ entryStore });

const { hono } = createApp({ routeModules: [entryRoutes] });

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

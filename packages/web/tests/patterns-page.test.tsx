// Async callbacks without await are necessary here: React's `act()` accepts
// async callbacks even for sync work.
/* eslint-disable @typescript-eslint/require-await */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, test, expect, beforeAll, afterAll, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { act } from "react";
import { createRoot } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Covers the regression this review caught: the read-only pattern dossier
 * page (app/patterns/[id]/page.tsx) rendered each sighting's evidence quote
 * and entry id but dropped sighting.entryText, regressing REQ-V1-17 for this
 * one surface even though curation-panel.tsx and the CLI still showed entry
 * context. This suite renders the page against a fake daemon and asserts the
 * entry text is present in the output.
 *
 * Ordering matters here: happy-dom's GlobalRegistrator mutates process-wide
 * globals and, unlike in curation-panel.test.tsx/entry-nudge.test.tsx (which
 * only mock `fetch`), it corrupts Node's `http` client's response parsing
 * (HPE_UNEXPECTED_CONTENT_LENGTH) for the real Unix-socket request that
 * lib/daemon.ts's daemonJson makes. So the daemon call must happen — and
 * fully resolve — before happy-dom is registered; only the render step needs
 * a DOM. PatternDossierPage does both in one async call, so each test
 * resolves the page (real fetch, no DOM yet) first, then registers happy-dom
 * to render the already-resolved JSX.
 */
describe("pattern dossier page", () => {
  let dataDir: string;
  let socketPath: string;
  let fakeDaemon: ReturnType<typeof Bun.serve>;

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "ink-mirror-patterns-page-test-"));
    socketPath = join(dataDir, "fake-daemon.sock");
    process.env.INK_MIRROR_SOCKET = socketPath;

    fakeDaemon = Bun.serve({
      unix: socketPath,
      fetch() {
        const dossier = {
          sightings: [
            {
              id: "obs-1",
              patternId: "pat-1",
              entryId: "entry-2026-07-01-001",
              evidence: ["Short. Sharp. Done."],
              dimension: "sentence-rhythm",
              createdAt: "2026-07-01T00:00:00.000Z",
              entryText: "Short. Sharp. Done. That was the whole entry.",
            },
          ],
          distinctEntryCount: 1,
          pattern: {
            id: "pat-1",
            statement: "Uses short declarative sentences for emphasis",
            dimension: "sentence-rhythm",
            status: "candidate",
            createdAt: "2026-07-01T00:00:00.000Z",
            updatedAt: "2026-07-01T00:00:00.000Z",
            sightingCount: 1,
            entryIds: ["entry-2026-07-01-001"],
          },
          isProposal: false,
        };
        return new Response(JSON.stringify(dossier), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
  });

  afterAll(() => {
    void fakeDaemon.stop(true);
    delete process.env.INK_MIRROR_SOCKET;
    rmSync(dataDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    if (GlobalRegistrator.isRegistered) {
      await GlobalRegistrator.unregister();
    }
  });

  test("renders the sighting's entry context alongside its evidence quote", async () => {
    const { default: PatternDossierPage } = await import("../app/patterns/[id]/page");

    // Resolve the page's data (real fetch over the fake daemon's Unix
    // socket) before happy-dom is registered — see file-level comment.
    const element = await PatternDossierPage({ params: Promise.resolve({ id: "pat-1" }) });

    GlobalRegistrator.register({ url: "http://localhost/" });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(element);
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Short. Sharp. Done. That was the whole entry.");
    expect(text).toContain("Short. Sharp. Done.");
    expect(text).toContain("Entry entry-2026-07-01-001");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

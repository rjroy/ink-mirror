// Async callbacks without await are necessary here: React's `act()` accepts
// async callbacks even for sync work (same convention as curation-panel.test.tsx).
/* eslint-disable @typescript-eslint/require-await */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { StreamedObservations, DiscoveredPatterns } from "../components/journal-editor";
import type { ObservationCreatedEvent, PatternDiscoveredEvent } from "@ink-mirror/shared";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// happy-dom's GlobalRegistrator mutates process-wide globals; scope
// registration to this describe block (same guard as entry-nudge.test.tsx /
// curation-panel.test.tsx, to avoid leaking into sibling SSE test files).
function setupHappyDom(): void {
  beforeAll(() => {
    if (typeof document === "undefined") {
      GlobalRegistrator.register({ url: "http://localhost/" });
    }
  });
  afterAll(async () => {
    if (GlobalRegistrator.isRegistered) {
      await GlobalRegistrator.unregister();
    }
  });
}

function makeObservationEvent(overrides: Partial<ObservationCreatedEvent> = {}): ObservationCreatedEvent {
  return {
    id: "obs-2026-07-11-001",
    entryId: "entry-2026-07-11-001",
    patternId: "pat-2026-07-11-001",
    pattern: "Uses short declarative sentences for emphasis",
    evidence: ["I stopped. I turned. I left."],
    dimension: "sentence-rhythm",
    createdAt: "2026-07-11T09:00:00.000Z",
    updatedAt: "2026-07-11T09:00:00.000Z",
    ...overrides,
  };
}

function makePatternDiscoveredEvent(
  overrides: Partial<PatternDiscoveredEvent["pattern"]> = {},
): PatternDiscoveredEvent {
  return {
    pattern: {
      id: "pat-2026-07-11-002",
      statement: "Opens paragraphs with a question",
      dimension: "sentence-rhythm",
      status: "candidate",
      createdAt: "2026-07-11T09:00:00.000Z",
      updatedAt: "2026-07-11T09:00:00.000Z",
      sightingCount: 1,
      entryIds: ["entry-2026-07-11-001"],
      ...overrides,
    },
  };
}

/**
 * REQ-LPC-11 requires observations to appear immediately after submission,
 * "presented as unconfirmed sightings until their pattern crosses
 * confirmation thresholds." journal-editor.tsx renders the live SSE stream
 * of observations through this component (StreamedObservations) right
 * after entry submission — this exercises exactly the piece the Phase 7
 * audit found missing (a repo-wide grep for "unconfirmed" previously
 * returned zero hits). Tested as its own component, not through the full
 * JournalEditor + router + SSE + fetch stack, since none of that wiring is
 * what changed here — only this render output did.
 */
describe("StreamedObservations (REQ-LPC-11)", () => {
  setupHappyDom();

  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    try {
      await act(async () => {
        root.unmount();
      });
    } catch {
      // already unmounted by the test
    }
    container.remove();
  });

  test("labels a freshly streamed observation as unconfirmed", async () => {
    await act(async () => {
      root.render(<StreamedObservations observations={[makeObservationEvent()]} />);
    });

    expect(container.textContent).toContain("Unconfirmed");
    const badge = container.querySelector(".im-badge-unconfirmed");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe("Unconfirmed");
    // The pattern text and dimension are still shown alongside the label —
    // the fix adds framing, it doesn't replace the existing content.
    expect(container.textContent).toContain("Uses short declarative sentences for emphasis");
    expect(container.textContent).toContain("sentence-rhythm");
  });

  test("labels every observation in a multi-sighting stream", async () => {
    await act(async () => {
      root.render(
        <StreamedObservations
          observations={[
            makeObservationEvent({ id: "obs-1" }),
            makeObservationEvent({ id: "obs-2", pattern: "Opens paragraphs with a question" }),
          ]}
        />,
      );
    });

    const badges = container.querySelectorAll(".im-badge-unconfirmed");
    expect(badges).toHaveLength(2);
  });

  test("renders nothing before any observation has streamed in", async () => {
    await act(async () => {
      root.render(<StreamedObservations observations={[]} />);
    });

    expect(container.textContent).not.toContain("Unconfirmed");
    expect(container.querySelector(".im-nudge-section")).toBeNull();
  });
});

/**
 * REQ-LPC-29's audited gap: `pattern:discovered` was a dead capability on
 * the web client — the SSE plumbing and handler slot existed in lib/api.ts
 * but journal-editor.tsx never wired onPatternDiscovered, so nothing ever
 * rendered it. DiscoveredPatterns is journal-editor.tsx's render of that
 * event within its existing submission-scoped SSE window. Tested as its own
 * component for the same reason as StreamedObservations: no router or live
 * SSE connection needed to verify the render.
 */
describe("DiscoveredPatterns (REQ-LPC-29)", () => {
  setupHappyDom();

  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    try {
      await act(async () => {
        root.unmount();
      });
    } catch {
      // already unmounted by the test
    }
    container.remove();
  });

  test("renders a freshly discovered pattern's statement and dimension", async () => {
    await act(async () => {
      root.render(<DiscoveredPatterns patterns={[makePatternDiscoveredEvent()]} />);
    });

    expect(container.textContent).toContain("New pattern noticed");
    expect(container.textContent).toContain("Opens paragraphs with a question");
    expect(container.textContent).toContain("sentence-rhythm");
  });

  test("renders every discovered pattern in a multi-discovery stream", async () => {
    await act(async () => {
      root.render(
        <DiscoveredPatterns
          patterns={[
            makePatternDiscoveredEvent({ id: "pat-1" }),
            makePatternDiscoveredEvent({ id: "pat-2", statement: "Uses short declarative sentences" }),
          ]}
        />,
      );
    });

    expect(container.querySelectorAll(".im-note")).toHaveLength(2);
  });

  test("renders nothing before any pattern has been discovered", async () => {
    await act(async () => {
      root.render(<DiscoveredPatterns patterns={[]} />);
    });

    expect(container.textContent).not.toContain("New pattern noticed");
    expect(container.querySelector(".im-nudge-section")).toBeNull();
  });
});

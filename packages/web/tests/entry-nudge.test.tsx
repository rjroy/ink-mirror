// Async callbacks without await are necessary here: React's `act()` accepts
// async callbacks even for sync work, and the fetch mock must return Promises
// because `typeof fetch` requires it.
/* eslint-disable @typescript-eslint/require-await */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";

// happy-dom's GlobalRegistrator mutates process-wide globals, including
// replacing WritableStream with a shim that lacks `.getWriter()`. Registering
// at module scope leaks into sibling test files (e.g. sse-streaming.test.ts,
// where Hono's SSE handler calls .getWriter() on a real WritableStream).
// Scope registration to describe blocks that need a DOM, and snapshot the
// stream globals as a safety net in case unregister() doesn't fully restore them.
type StreamGlobals = {
  WritableStream: typeof globalThis.WritableStream;
  ReadableStream: typeof globalThis.ReadableStream;
  TransformStream: typeof globalThis.TransformStream;
};

function setupHappyDom(): void {
  const snapshot: StreamGlobals = {
    WritableStream: globalThis.WritableStream,
    ReadableStream: globalThis.ReadableStream,
    TransformStream: globalThis.TransformStream,
  };
  beforeAll(() => {
    if (typeof document === "undefined") {
      GlobalRegistrator.register({ url: "http://localhost/" });
    }
  });
  afterAll(async () => {
    if (GlobalRegistrator.isRegistered) {
      await GlobalRegistrator.unregister();
    }
    globalThis.WritableStream = snapshot.WritableStream;
    globalThis.ReadableStream = snapshot.ReadableStream;
    globalThis.TransformStream = snapshot.TransformStream;
  });
}
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EntryNudge,
  formatRelativeTime,
  formatSavedLabel,
  toResultState,
} from "../components/entry-nudge";
import type { NudgeResponse } from "@ink-mirror/shared";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type FetchCall = { url: string; init: RequestInit | undefined };

const baseMetrics = {
  passiveRatio: 0.1,
  totalSentences: 5,
  hedgingWordCount: 0,
  rhythmVariance: 1.2,
};

const sampleNudge = {
  craftPrinciple: "passive-voice-clustering" as const,
  evidence: "The room was entered.",
  observation: "One passive sentence.",
  question: "Whose action is this?",
};

const secondNudge = {
  craftPrinciple: "hedging-accumulation" as const,
  evidence: "It might perhaps be the case.",
  observation: "Multiple hedging words.",
  question: "What would commitment look like?",
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function flushAsync(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

describe("EntryNudge module", () => {
  test("exports EntryNudge component", () => {
    expect(typeof EntryNudge).toBe("function");
  });
});

describe("formatRelativeTime", () => {
  test("returns 'just now' for recent timestamp", () => {
    const now = new Date("2026-04-22T12:00:00.000Z");
    const ts = new Date("2026-04-22T11:59:50.000Z").toISOString();
    expect(formatRelativeTime(ts, now)).toBe("just now");
  });

  test("returns minutes ago", () => {
    const now = new Date("2026-04-22T12:05:00.000Z");
    const ts = new Date("2026-04-22T12:00:00.000Z").toISOString();
    expect(formatRelativeTime(ts, now)).toBe("5 minutes ago");
  });

  test("returns hours ago", () => {
    const now = new Date("2026-04-22T15:00:00.000Z");
    const ts = new Date("2026-04-22T12:00:00.000Z").toISOString();
    expect(formatRelativeTime(ts, now)).toBe("3 hours ago");
  });

  test("returns days ago", () => {
    const now = new Date("2026-04-25T12:00:00.000Z");
    const ts = new Date("2026-04-22T12:00:00.000Z").toISOString();
    expect(formatRelativeTime(ts, now)).toBe("3 days ago");
  });

  test("falls back to ISO date for very old timestamp", () => {
    const now = new Date("2026-06-22T12:00:00.000Z");
    const ts = new Date("2026-01-01T12:00:00.000Z").toISOString();
    expect(formatRelativeTime(ts, now)).toBe("2026-01-01");
  });
});

describe("formatSavedLabel", () => {
  const now = new Date("2026-04-22T12:00:00.000Z");
  const tsTwoMin = new Date("2026-04-22T11:58:00.000Z").toISOString();

  test("includes Saved prefix and relative time when not stale", () => {
    expect(formatSavedLabel(tsTwoMin, false, now)).toBe("Saved 2 minutes ago");
  });

  test("appends ' \u2014 entry edited since' when stale", () => {
    expect(formatSavedLabel(tsTwoMin, true, now)).toBe(
      "Saved 2 minutes ago \u2014 entry edited since",
    );
  });
});

describe("toResultState", () => {
  test("normalizes missing stale to false", () => {
    const response: NudgeResponse = {
      nudges: [sampleNudge],
      metrics: baseMetrics,
      source: "fresh",
      generatedAt: "2026-04-22T12:00:00.000Z",
      contentHash: "sha256:abc",
    };
    const state = toResultState(response);
    expect(state.stale).toBe(false);
    expect(state.source).toBe("fresh");
    expect(state.nudges).toHaveLength(1);
  });

  test("preserves stale: true from cache response", () => {
    const response: NudgeResponse = {
      nudges: [sampleNudge],
      metrics: baseMetrics,
      source: "cache",
      stale: true,
      generatedAt: "2026-04-22T12:00:00.000Z",
      contentHash: "sha256:abc",
    };
    const state = toResultState(response);
    expect(state.stale).toBe(true);
    expect(state.source).toBe("cache");
  });

  test("ignores stale: true when source is fresh (defensive)", () => {
    const response = {
      nudges: [sampleNudge],
      metrics: baseMetrics,
      source: "fresh",
      stale: true,
      generatedAt: "2026-04-22T12:00:00.000Z",
      contentHash: "sha256:abc",
    } as unknown as NudgeResponse;
    const state = toResultState(response);
    expect(state.stale).toBe(false);
  });
});

describe("EntryNudge initial render", () => {
  test("shows only the Nudge button before any click", () => {
    const html = renderToStaticMarkup(<EntryNudge entryId="entry-2026-04-22-001" />);
    expect(html).toContain(">Nudge<");
    expect(html).not.toContain("Regenerate");
    expect(html).not.toContain("Saved");
    expect(html).not.toContain("Craft Nudges");
  });
});

describe("EntryNudge interactive behavior", () => {
  setupHappyDom();

  let container: HTMLElement;
  let root: Root;
  let originalFetch: typeof globalThis.fetch;
  let calls: FetchCall[];

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    originalFetch = globalThis.fetch;
    calls = [];
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
    globalThis.fetch = originalFetch;
  });

  function queueResponses(responses: NudgeResponse[]): void {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      calls.push({ url, init });
      const next = responses.shift();
      if (!next) throw new Error("no response queued");
      return jsonResponse(next);
    }) as typeof globalThis.fetch;
  }

  function findButton(label: RegExp | string): HTMLButtonElement {
    const buttons = Array.from(container.querySelectorAll("button"));
    const matcher =
      typeof label === "string"
        ? (text: string) => text === label
        : (text: string) => label.test(text);
    const btn = buttons.find((b) => matcher(b.textContent ?? ""));
    if (!btn) {
      throw new Error(
        `button not found: ${label}. Available: ${buttons.map((b) => b.textContent).join(" | ")}`,
      );
    }
    return btn;
  }

  test("click Nudge with no saved nudge posts without refresh and renders result", async () => {
    queueResponses([
      {
        nudges: [sampleNudge],
        metrics: baseMetrics,
        source: "fresh",
        generatedAt: "2026-04-22T11:58:00.000Z",
        contentHash: "sha256:abc",
      },
    ]);

    await act(async () => {
      root.render(<EntryNudge entryId="entry-2026-04-22-001" />);
    });

    await act(async () => {
      findButton("Nudge").click();
    });
    await flushAsync();

    expect(calls).toHaveLength(1);
    const body = JSON.parse(calls[0].init?.body as string) as Record<
      string,
      unknown
    >;
    expect(body).toEqual({ entryId: "entry-2026-04-22-001" });
    expect("refresh" in body).toBe(false);

    const text = container.textContent ?? "";
    expect(text).toContain("Craft Nudges");
    expect(text).toContain(sampleNudge.observation);
    expect(text).toContain("Saved");
    findButton(/Regenerate/);
  });

  test("cache response with stale: false omits the edited-since suffix", async () => {
    queueResponses([
      {
        nudges: [sampleNudge],
        metrics: baseMetrics,
        source: "cache",
        stale: false,
        generatedAt: "2026-04-22T11:58:00.000Z",
        contentHash: "sha256:abc",
      },
    ]);

    await act(async () => {
      root.render(<EntryNudge entryId="entry-2026-04-22-002" />);
    });
    await act(async () => {
      findButton("Nudge").click();
    });
    await flushAsync();

    const text = container.textContent ?? "";
    expect(text).toContain("Saved");
    expect(text).not.toContain("\u2014 entry edited since");
  });

  test("cache response with stale: true renders the edited-since suffix", async () => {
    queueResponses([
      {
        nudges: [sampleNudge],
        metrics: baseMetrics,
        source: "cache",
        stale: true,
        generatedAt: "2026-04-22T11:58:00.000Z",
        contentHash: "sha256:abc",
      },
    ]);

    await act(async () => {
      root.render(<EntryNudge entryId="entry-2026-04-22-003" />);
    });
    await act(async () => {
      findButton("Nudge").click();
    });
    await flushAsync();

    const text = container.textContent ?? "";
    expect(text).toContain("\u2014 entry edited since");
  });

  test("click Regenerate posts with refresh: true and updates the rendered result", async () => {
    queueResponses([
      {
        nudges: [sampleNudge],
        metrics: baseMetrics,
        source: "cache",
        stale: false,
        generatedAt: "2026-04-22T11:58:00.000Z",
        contentHash: "sha256:first",
      },
      {
        nudges: [secondNudge],
        metrics: baseMetrics,
        source: "fresh",
        generatedAt: "2026-04-22T11:59:30.000Z",
        contentHash: "sha256:second",
      },
    ]);

    await act(async () => {
      root.render(<EntryNudge entryId="entry-2026-04-22-004" />);
    });
    await act(async () => {
      findButton("Nudge").click();
    });
    await flushAsync();

    expect(container.textContent ?? "").toContain(sampleNudge.observation);

    await act(async () => {
      findButton(/Regenerate/).click();
    });
    await flushAsync();

    expect(calls).toHaveLength(2);
    const firstBody = JSON.parse(calls[0].init?.body as string) as Record<
      string,
      unknown
    >;
    const secondBody = JSON.parse(calls[1].init?.body as string) as Record<
      string,
      unknown
    >;
    expect("refresh" in firstBody).toBe(false);
    expect(secondBody.refresh).toBe(true);
    expect(secondBody.entryId).toBe("entry-2026-04-22-004");

    const text = container.textContent ?? "";
    expect(text).toContain(secondNudge.observation);
    expect(text).not.toContain(sampleNudge.observation);
  });

  test("fetch resolving after unmount does not crash (abort-on-unmount guard)", async () => {
    let resolveFetch: (response: Response) => void = () => {};
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      calls.push({ url, init });
      return new Promise<Response>((res) => {
        resolveFetch = res;
      });
    }) as typeof globalThis.fetch;

    const consoleErrors: unknown[] = [];
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      consoleErrors.push(args);
    };

    try {
      await act(async () => {
        root.render(<EntryNudge entryId="entry-2026-04-22-005" />);
      });
      await act(async () => {
        findButton("Nudge").click();
      });

      // Unmount while fetch is still pending.
      await act(async () => {
        root.unmount();
      });

      // Resolve the pending fetch after unmount. The guard should no-op.
      await act(async () => {
        resolveFetch(
          jsonResponse({
            nudges: [sampleNudge],
            metrics: baseMetrics,
            source: "fresh",
            generatedAt: "2026-04-22T11:58:00.000Z",
            contentHash: "sha256:abc",
          } satisfies NudgeResponse),
        );
        await new Promise((r) => setTimeout(r, 0));
      });
      await flushAsync();

      expect(calls).toHaveLength(1);
      const stateWarnings = consoleErrors.filter((args) => {
        const first = Array.isArray(args) ? args[0] : args;
        return (
          typeof first === "string" &&
          (first.includes("unmounted") ||
            first.includes("memory leak") ||
            first.includes("act(..."))
        );
      });
      expect(stateWarnings).toHaveLength(0);
    } finally {
      console.error = originalConsoleError;
    }
  });
});

describe("EntryNudge error handling", () => {
  setupHappyDom();

  let container: HTMLElement;
  let root: Root;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    originalFetch = globalThis.fetch;
  });

  afterEach(async () => {
    try {
      await act(async () => {
        root.unmount();
      });
    } catch {
      // already unmounted
    }
    container.remove();
    globalThis.fetch = originalFetch;
  });

  test("response with error and empty nudges hides the Saved label", async () => {
    globalThis.fetch = (async () =>
      jsonResponse({
        nudges: [],
        metrics: baseMetrics,
        source: "fresh",
        generatedAt: "2026-04-22T11:58:00.000Z",
        contentHash: "sha256:err",
        error: "llm unavailable",
      })) as unknown as typeof globalThis.fetch;

    await act(async () => {
      root.render(<EntryNudge entryId="entry-2026-04-22-006" />);
    });
    await act(async () => {
      const btn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent === "Nudge",
      );
      btn?.click();
    });
    await (async () => {
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          await new Promise((r) => setTimeout(r, 0));
        });
      }
    })();

    const text = container.textContent ?? "";
    expect(text).toContain("llm unavailable");
    expect(text).not.toContain("Saved");
  });
});

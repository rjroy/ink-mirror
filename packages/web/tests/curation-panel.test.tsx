// Async callbacks without await are necessary here: React's `act()` accepts
// async callbacks even for sync work, and the fetch mock must return Promises
// because `typeof fetch` requires it.
/* eslint-disable @typescript-eslint/require-await */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  CurationPanel,
  selectAccumulatingPatterns,
  mergeCandidatesFor,
  formatSightingSummary,
  formatProposalSummary,
} from "../components/curation-panel";
import type {
  Pattern,
  PatternProposal,
  Dossier,
  PatternCurationSession,
  ResurfacedRule,
} from "@ink-mirror/shared";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// happy-dom's GlobalRegistrator mutates process-wide globals; scope
// registration to the describe block that needs a DOM (same guard as
// entry-nudge.test.tsx, to avoid leaking into sibling SSE test files).
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

function makePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    id: "pat-2026-07-10-001",
    statement: "Uses short declarative sentences for emphasis",
    dimension: "sentence-rhythm",
    status: "candidate",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    sightingCount: 1,
    entryIds: ["entry-2026-07-01-001"],
    ...overrides,
  };
}

function makeDossier(overrides: Partial<Dossier> = {}): Dossier {
  const { pattern: patternOverride, ...rest } = overrides;
  const pattern = patternOverride ?? makePattern();
  return {
    sightings: [
      {
        id: "obs-2026-07-01-001",
        patternId: pattern.id,
        entryId: "entry-2026-07-01-001",
        evidence: "Short. Sharp. Done.",
        dimension: pattern.dimension,
        createdAt: "2026-07-01T00:00:00.000Z",
        entryText: "Short. Sharp. Done. That was the whole entry.",
      },
    ],
    distinctEntryCount: 1,
    pattern,
    isProposal: false,
    ...rest,
  };
}

function emptySession(): PatternCurationSession & { proposals: PatternProposal[] } {
  return { dossiers: [], contradictions: [], watchList: [], resurfacedRules: [], proposals: [] };
}

describe("curation-panel pure helpers", () => {
  test("selectAccumulatingPatterns keeps only intentional patterns with no rule and no pending proposal", () => {
    const kept = makePattern({ id: "pat-kept", status: "intentional" });
    const alreadyPromoted = makePattern({ id: "pat-promoted", status: "intentional", ruleId: "rule-1" });
    const alreadyProposed = makePattern({ id: "pat-proposed", status: "intentional" });
    const stillCandidate = makePattern({ id: "pat-candidate", status: "candidate" });

    const proposals: PatternProposal[] = [
      {
        patternId: "pat-proposed",
        statement: alreadyProposed.statement,
        dimension: alreadyProposed.dimension,
        sightingCount: 3,
        distinctEntryCount: 3,
        totalWordCount: 2000,
      },
    ];

    const result = selectAccumulatingPatterns(
      [kept, alreadyPromoted, alreadyProposed, stillCandidate],
      proposals,
    );

    expect(result.map((p) => p.id)).toEqual(["pat-kept"]);
  });

  test("mergeCandidatesFor excludes self, other dimensions, and retired patterns", () => {
    const source = makePattern({ id: "pat-source", dimension: "sentence-rhythm" });
    const sameDim = makePattern({ id: "pat-same-dim", dimension: "sentence-rhythm" });
    const otherDim = makePattern({ id: "pat-other-dim", dimension: "word-level-habits" });
    const retired = makePattern({ id: "pat-retired", dimension: "sentence-rhythm", status: "retired" });

    const result = mergeCandidatesFor(source, [source, sameDim, otherDim, retired]);
    expect(result.map((p) => p.id)).toEqual(["pat-same-dim"]);
  });

  test("formatSightingSummary pluralizes correctly", () => {
    const singular = makeDossier({ distinctEntryCount: 1, pattern: makePattern({ sightingCount: 1 }) });
    expect(formatSightingSummary(singular)).toBe("1 sighting across 1 entry");

    const plural = makeDossier({ distinctEntryCount: 2, pattern: makePattern({ sightingCount: 3 }) });
    expect(formatSightingSummary(plural)).toBe("3 sightings across 2 entries");
  });

  test("formatProposalSummary reports deterministic evidence numbers from the API, never invented ones", () => {
    const proposal: PatternProposal = {
      patternId: "pat-1",
      statement: "Test",
      dimension: "sentence-rhythm",
      sightingCount: 3,
      distinctEntryCount: 3,
      totalWordCount: 2100,
    };
    expect(formatProposalSummary(proposal)).toBe("3 sightings across 3 entries, 2100 words total");
  });
});

describe("CurationPanel interactive behavior", () => {
  setupHappyDom();

  let container: HTMLElement;
  let root: Root;
  let originalFetch: typeof globalThis.fetch;
  let calls: Array<{ url: string; init?: RequestInit }>;

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

  function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  async function flushAsync(): Promise<void> {
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
    }
  }

  /** Routes the fetch mock by method + pathname, recording every call. */
  function installFetchMock(handlers: Record<string, () => unknown>): void {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      calls.push({ url, init });
      const path = new URL(url, "http://localhost").pathname;
      const key = `${init?.method ?? "GET"} ${path}`;
      const handler = handlers[key];
      if (!handler) {
        throw new Error(`no fetch mock registered for ${key}`);
      }
      return jsonResponse(handler());
    }) as typeof globalThis.fetch;
  }

  test("empty session shows the quiet-reading-room state", async () => {
    installFetchMock({
      "GET /api/patterns/session": () => emptySession(),
      "GET /api/patterns": () => [],
    });

    await act(async () => {
      root.render(<CurationPanel />);
    });
    await flushAsync();

    expect(container.textContent ?? "").toContain("reading-room is quiet");
  });

  test("classify buttons post the right status and refresh the session", async () => {
    const dossier = makeDossier();
    let sessionCallCount = 0;
    installFetchMock({
      "GET /api/patterns/session": () => {
        sessionCallCount += 1;
        return sessionCallCount === 1 ? { ...emptySession(), dossiers: [dossier] } : emptySession();
      },
      "GET /api/patterns": () => [dossier.pattern],
      "POST /api/patterns/pat-2026-07-10-001/classify": () => ({ ...dossier.pattern, status: "accidental" }),
    });

    await act(async () => {
      root.render(<CurationPanel />);
    });
    await flushAsync();

    expect(container.textContent ?? "").toContain(dossier.pattern.statement);

    const releaseButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Release",
    );
    expect(releaseButton).toBeDefined();

    await act(async () => {
      releaseButton!.click();
    });
    await flushAsync();

    const classifyCall = calls.find((c) => c.url.includes("/classify"));
    expect(classifyCall).toBeDefined();
    const body = JSON.parse(classifyCall!.init?.body as string) as Record<string, unknown>;
    expect(body).toEqual({ status: "accidental" });

    // Session reloaded after the action (dossiers now empty on the 2nd call).
    expect(container.textContent ?? "").toContain("reading-room is quiet");
  });

  test("promote-on-keep checkbox includes promote: true in the classify request (REQ-LPC-16)", async () => {
    const dossier = makeDossier();
    installFetchMock({
      "GET /api/patterns/session": () => ({ ...emptySession(), dossiers: [dossier] }),
      "GET /api/patterns": () => [dossier.pattern],
      "POST /api/patterns/pat-2026-07-10-001/classify": () => ({
        ...dossier.pattern,
        status: "intentional",
        ruleId: "rule-1",
      }),
    });

    await act(async () => {
      root.render(<CurationPanel />);
    });
    await flushAsync();

    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await act(async () => {
      checkbox.click();
    });

    const keepButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Keep — this is on purpose",
    );
    await act(async () => {
      keepButton!.click();
    });
    await flushAsync();

    const classifyCall = calls.find((c) => c.url.includes("/classify"));
    const body = JSON.parse(classifyCall!.init?.body as string) as Record<string, unknown>;
    expect(body).toEqual({ status: "intentional", promote: true });
  });

  test("evidence-accumulating section renders honestly for a below-threshold intentional pattern (REQ-LPC-26)", async () => {
    const accumulatingPattern = makePattern({
      id: "pat-accumulating",
      status: "intentional",
      sightingCount: 1,
      entryIds: ["entry-1"],
    });
    installFetchMock({
      "GET /api/patterns/session": () => emptySession(),
      "GET /api/patterns": () => [accumulatingPattern],
    });

    await act(async () => {
      root.render(<CurationPanel />);
    });
    await flushAsync();

    const text = container.textContent ?? "";
    expect(text).toContain("Evidence still accumulating");
    expect(text).toContain(accumulatingPattern.statement);
    expect(text).not.toContain("not intentional enough");
  });

  test("proposal accept posts action: accept and refreshes the session", async () => {
    const proposal: PatternProposal = {
      patternId: "pat-2026-07-10-002",
      statement: "Favors compound sentences joined by conjunctions",
      dimension: "sentence-structure",
      sightingCount: 3,
      distinctEntryCount: 3,
      totalWordCount: 2100,
    };
    let sessionCallCount = 0;
    installFetchMock({
      "GET /api/patterns/session": () => {
        sessionCallCount += 1;
        return sessionCallCount === 1
          ? { ...emptySession(), proposals: [proposal] }
          : emptySession();
      },
      "GET /api/patterns": () => [],
      "POST /api/patterns/pat-2026-07-10-002/proposal": () => ({ id: proposal.patternId, ruleId: "rule-1" }),
    });

    await act(async () => {
      root.render(<CurationPanel />);
    });
    await flushAsync();

    expect(container.textContent ?? "").toContain("Ready to promote");

    const acceptButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Accept",
    );
    await act(async () => {
      acceptButton!.click();
    });
    await flushAsync();

    const proposalCall = calls.find((c) => c.url.includes("/proposal"));
    expect(proposalCall).toBeDefined();
    const body = JSON.parse(proposalCall!.init?.body as string) as Record<string, unknown>;
    expect(body).toEqual({ action: "accept" });
  });

  test("resurfaced rule renders reasons and reaffirm/retire call the right endpoints", async () => {
    const resurfaced: ResurfacedRule = {
      rule: {
        id: "rule-1",
        pattern: "Uses short declarative sentences for emphasis",
        dimension: "sentence-rhythm",
        sourceCount: 3,
        sourceSummary: "Confirmed across 3 entries",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
        patternId: "pat-stale-001",
      },
      pattern: makePattern({ id: "pat-stale-001", status: "intentional" }),
      reasons: ["stale"],
      staleness: { windowSize: 10 },
    };
    installFetchMock({
      "GET /api/patterns/session": () => ({ ...emptySession(), resurfacedRules: [resurfaced] }),
      "GET /api/patterns": () => [],
      "POST /api/patterns/pat-stale-001/reaffirm": () => ({ id: "rule-1", lastSupportedAt: "now" }),
    });

    await act(async () => {
      root.render(<CurationPanel />);
    });
    await flushAsync();

    const text = container.textContent ?? "";
    expect(text).toContain("Resurfaced for review");
    expect(text).toContain("Stale");

    const reaffirmButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Reaffirm",
    );
    await act(async () => {
      reaffirmButton!.click();
    });
    await flushAsync();

    expect(calls.some((c) => c.url.includes("/patterns/pat-stale-001/reaffirm"))).toBe(true);
  });

  test("watch list renders recurrence text verbatim from the API, never recomputed client-side", async () => {
    const watchedDossier = makeDossier({
      pattern: makePattern({ id: "pat-watched", status: "accidental" }),
      watchStatus: {
        classifiedAt: "2026-07-01T00:00:00.000Z",
        recurrenceText: "Seen in 2 of 5 entries since you marked this accidental.",
        resolved: false,
      },
    });
    installFetchMock({
      "GET /api/patterns/session": () => ({ ...emptySession(), watchList: [watchedDossier] }),
      "GET /api/patterns": () => [],
    });

    await act(async () => {
      root.render(<CurationPanel />);
    });
    await flushAsync();

    expect(container.textContent ?? "").toContain(
      "Seen in 2 of 5 entries since you marked this accidental.",
    );
  });

  test("merge sends the selected duplicate id and refreshes the session", async () => {
    const dossier = makeDossier();
    const duplicate = makePattern({ id: "pat-2026-07-10-003", dimension: dossier.pattern.dimension });
    let sessionCallCount = 0;
    installFetchMock({
      "GET /api/patterns/session": () => {
        sessionCallCount += 1;
        return sessionCallCount === 1 ? { ...emptySession(), dossiers: [dossier] } : emptySession();
      },
      "GET /api/patterns": () => [dossier.pattern, duplicate],
      "POST /api/patterns/pat-2026-07-10-001/merge": () => ({ ...dossier.pattern, sightingCount: 2 }),
    });

    await act(async () => {
      root.render(<CurationPanel />);
    });
    await flushAsync();

    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select).toBeDefined();

    await act(async () => {
      select.value = duplicate.id;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const mergeButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Merge",
    );
    expect(mergeButton).toBeDefined();
    expect(mergeButton!.hasAttribute("disabled")).toBe(false);

    await act(async () => {
      mergeButton!.click();
    });
    await flushAsync();

    const mergeCall = calls.find((c) => c.url.includes("/merge"));
    expect(mergeCall).toBeDefined();
    const body = JSON.parse(mergeCall!.init?.body as string) as Record<string, unknown>;
    expect(body).toEqual({ duplicateId: duplicate.id });

    // Session reloaded after the action (dossiers now empty on the 2nd call).
    expect(container.textContent ?? "").toContain("reading-room is quiet");
  });

  test("detach posts the sighting id and refreshes the session", async () => {
    const dossier = makeDossier();
    let sessionCallCount = 0;
    installFetchMock({
      "GET /api/patterns/session": () => {
        sessionCallCount += 1;
        return sessionCallCount === 1 ? { ...emptySession(), dossiers: [dossier] } : emptySession();
      },
      "GET /api/patterns": () => [dossier.pattern],
      "POST /api/patterns/pat-2026-07-10-001/detach": () => ({
        source: dossier.pattern,
        newPattern: makePattern({ id: "pat-2026-07-10-010" }),
      }),
    });

    await act(async () => {
      root.render(<CurationPanel />);
    });
    await flushAsync();

    const detachButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Detach this sighting",
    );
    expect(detachButton).toBeDefined();

    await act(async () => {
      detachButton!.click();
    });
    await flushAsync();

    const detachCall = calls.find((c) => c.url.includes("/detach"));
    expect(detachCall).toBeDefined();
    const body = JSON.parse(detachCall!.init?.body as string) as Record<string, unknown>;
    expect(body).toEqual({ sightingId: dossier.sightings[0].id });

    expect(container.textContent ?? "").toContain("reading-room is quiet");
  });

  test("dismiss posts an empty body and refreshes the session", async () => {
    const dossier = makeDossier();
    let sessionCallCount = 0;
    installFetchMock({
      "GET /api/patterns/session": () => {
        sessionCallCount += 1;
        return sessionCallCount === 1 ? { ...emptySession(), dossiers: [dossier] } : emptySession();
      },
      "GET /api/patterns": () => [dossier.pattern],
      "POST /api/patterns/pat-2026-07-10-001/dismiss": () => ({ ...dossier.pattern, status: "retired" }),
    });

    await act(async () => {
      root.render(<CurationPanel />);
    });
    await flushAsync();

    const dismissButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Dismiss — not a real pattern",
    );
    expect(dismissButton).toBeDefined();

    await act(async () => {
      dismissButton!.click();
    });
    await flushAsync();

    const dismissCall = calls.find((c) => c.url.includes("/dismiss"));
    expect(dismissCall).toBeDefined();
    const body = JSON.parse(dismissCall!.init?.body as string) as Record<string, unknown>;
    expect(body).toEqual({});

    expect(container.textContent ?? "").toContain("reading-room is quiet");
  });

  test("proposal decline posts action: decline and refreshes the session", async () => {
    const proposal: PatternProposal = {
      patternId: "pat-2026-07-10-004",
      statement: "Opens paragraphs with a question",
      dimension: "sentence-structure",
      sightingCount: 3,
      distinctEntryCount: 3,
      totalWordCount: 1800,
    };
    let sessionCallCount = 0;
    installFetchMock({
      "GET /api/patterns/session": () => {
        sessionCallCount += 1;
        return sessionCallCount === 1
          ? { ...emptySession(), proposals: [proposal] }
          : emptySession();
      },
      "GET /api/patterns": () => [],
      "POST /api/patterns/pat-2026-07-10-004/proposal": () => ({ id: proposal.patternId, status: "candidate" }),
    });

    await act(async () => {
      root.render(<CurationPanel />);
    });
    await flushAsync();

    expect(container.textContent ?? "").toContain("Ready to promote");

    const declineButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Decline",
    );
    expect(declineButton).toBeDefined();

    await act(async () => {
      declineButton!.click();
    });
    await flushAsync();

    const proposalCall = calls.find((c) => c.url.includes("/proposal"));
    expect(proposalCall).toBeDefined();
    const body = JSON.parse(proposalCall!.init?.body as string) as Record<string, unknown>;
    expect(body).toEqual({ action: "decline" });

    // Session reloaded after the action; the proposal is gone.
    expect(container.textContent ?? "").not.toContain("Ready to promote");
  });

  test("promote now anyway posts an empty body and drops the pattern from accumulating evidence", async () => {
    const accumulatingPattern = makePattern({
      id: "pat-2026-07-10-005",
      status: "intentional",
      sightingCount: 1,
      entryIds: ["entry-1"],
    });
    let patternsCallCount = 0;
    installFetchMock({
      "GET /api/patterns/session": () => emptySession(),
      "GET /api/patterns": () => {
        patternsCallCount += 1;
        return patternsCallCount === 1 ? [accumulatingPattern] : [];
      },
      "POST /api/patterns/pat-2026-07-10-005/promote": () => ({
        ...accumulatingPattern,
        ruleId: "rule-9",
      }),
    });

    await act(async () => {
      root.render(<CurationPanel />);
    });
    await flushAsync();

    expect(container.textContent ?? "").toContain("Evidence still accumulating");

    const promoteButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Promote now anyway",
    );
    expect(promoteButton).toBeDefined();

    await act(async () => {
      promoteButton!.click();
    });
    await flushAsync();

    const promoteCall = calls.find((c) => c.url.includes("/promote"));
    expect(promoteCall).toBeDefined();
    const body = JSON.parse(promoteCall!.init?.body as string) as Record<string, unknown>;
    expect(body).toEqual({});

    // Patterns reloaded after the action; the promoted pattern no longer accumulates.
    expect(container.textContent ?? "").not.toContain("Evidence still accumulating");
  });

  test("retire on a resurfaced rule posts an empty body and refreshes the session", async () => {
    const resurfaced: ResurfacedRule = {
      rule: {
        id: "rule-2",
        pattern: "Ends paragraphs with a rhetorical question",
        dimension: "sentence-structure",
        sourceCount: 4,
        sourceSummary: "Confirmed across 4 entries",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
        patternId: "pat-stale-002",
      },
      pattern: makePattern({ id: "pat-stale-002", status: "intentional", dimension: "sentence-structure" }),
      reasons: ["drifting"],
      drift: { rollingMean: 0.8, baseline: 0.3, relativeDeviation: 1.6, margin: 0.5 },
    };
    let sessionCallCount = 0;
    installFetchMock({
      "GET /api/patterns/session": () => {
        sessionCallCount += 1;
        return sessionCallCount === 1 ? { ...emptySession(), resurfacedRules: [resurfaced] } : emptySession();
      },
      "GET /api/patterns": () => [],
      "POST /api/patterns/pat-stale-002/retire": () => ({ ...resurfaced.pattern, status: "retired" }),
    });

    await act(async () => {
      root.render(<CurationPanel />);
    });
    await flushAsync();

    expect(container.textContent ?? "").toContain("Resurfaced for review");

    const retireButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Retire",
    );
    expect(retireButton).toBeDefined();

    await act(async () => {
      retireButton!.click();
    });
    await flushAsync();

    const retireCall = calls.find((c) => c.url.includes("/retire"));
    expect(retireCall).toBeDefined();
    const body = JSON.parse(retireCall!.init?.body as string) as Record<string, unknown>;
    expect(body).toEqual({});

    // Session reloaded after the action; the resurfaced rule is gone.
    expect(container.textContent ?? "").toContain("reading-room is quiet");
  });
});

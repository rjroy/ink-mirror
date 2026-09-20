// Async callbacks without await are necessary here: React's `act()` accepts
// async callbacks even for sync work, and the fetch mock must return Promises
// because `typeof fetch` requires it.
/* eslint-disable @typescript-eslint/require-await */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  ProfileEditor,
  healthState,
  healthLabel,
  provenanceLabel,
} from "../components/profile-editor";
import type { Profile, ProfileRule, ResurfacedRule, Pattern } from "@ink-mirror/shared";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function makeRule(overrides: Partial<ProfileRule> = {}): ProfileRule {
  return {
    id: "rule-sentence-rhythm-001",
    pattern: "Uses short declarative sentences for emphasis",
    dimension: "sentence-rhythm",
    sourceCount: 3,
    sourceSummary: "Confirmed across 3 entries",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    patternId: "pat-2026-06-01-001",
    provenance: "evidence-confirmed",
    ...overrides,
  };
}

function makePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    id: "pat-2026-06-01-001",
    statement: "Uses short declarative sentences for emphasis",
    dimension: "sentence-rhythm",
    status: "intentional",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    sightingCount: 3,
    entryIds: ["entry-1", "entry-2", "entry-3"],
    ...overrides,
  };
}

function makeProfile(rules: ProfileRule[]): Profile & { markdown: string } {
  return { version: 2, updatedAt: "2026-06-01T00:00:00.000Z", rules, markdown: "" };
}

describe("profile-editor pure helpers", () => {
  test("healthState maps resurfaced-rule reasons to a single label", () => {
    expect(healthState([])).toBe("fine");
    expect(healthState(["stale"])).toBe("stale");
    expect(healthState(["drift"])).toBe("drift");
    expect(healthState(["stale", "drift"])).toBe("stale-and-drift");
  });

  test("healthLabel renders human-readable text for each state", () => {
    expect(healthLabel("fine")).toBe("Fine");
    expect(healthLabel("stale")).toBe("Stale");
    expect(healthLabel("drift")).toBe("Drifting");
    expect(healthLabel("stale-and-drift")).toBe("Stale + Drifting");
  });

  test("provenanceLabel distinguishes writer-asserted from evidence-confirmed, and degrades honestly when absent (REQ-LPC-16)", () => {
    expect(provenanceLabel("writer-asserted")).toBe("Writer-asserted");
    expect(provenanceLabel("evidence-confirmed")).toBe("Evidence-confirmed");
    expect(provenanceLabel(undefined)).toBe("Unspecified provenance");
  });
});

describe("ProfileEditor rendering", () => {
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

  // next/link schedules a microtask (route prefetch/announcer setup) after
  // its own render commits; flushing once more after the render act() lets
  // that settle inside act() instead of firing a spurious "not wrapped in
  // act()" warning once the test's own act() block has already closed.
  async function flushLinkEffects(): Promise<void> {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }

  test("shows a provenance badge and dossier link for a rule with real evidence", async () => {
    const rule = makeRule({ provenance: "writer-asserted" });
    const pattern = makePattern();

    await act(async () => {
      root.render(
        <ProfileEditor
          initialProfile={makeProfile([rule])}
          resurfacedRules={[]}
          patterns={[pattern]}
        />,
      );
    });
    await flushLinkEffects();

    const text = container.textContent ?? "";
    expect(text).toContain("Writer-asserted");
    expect(text).toContain("Fine");
    expect(text).toContain("Confirmed across 3 entries");

    const dossierLink = container.querySelector(`a[href="/patterns/${pattern.id}"]`);
    expect(dossierLink).not.toBeNull();
    expect(dossierLink?.textContent).toBe("Why does it say this?");
  });

  test("renders the migrated/no-history state explicitly instead of a misleading evidence count (REQ-LPC-18/27)", async () => {
    const rule = makeRule({ provenance: "writer-asserted", sourceSummary: "Confirmed across 0 entries", sourceCount: 0 });
    const migratedPattern = makePattern({ migratedNoHistory: true, sightingCount: 0, entryIds: [] });

    await act(async () => {
      root.render(
        <ProfileEditor
          initialProfile={makeProfile([rule])}
          resurfacedRules={[]}
          patterns={[migratedPattern]}
        />,
      );
    });
    await flushLinkEffects();

    const text = container.textContent ?? "";
    expect(text).toContain("Migrated");
    expect(text).toContain("no historical sightings recorded");
    // The honestly-labeled migrated state replaces the (potentially
    // misleading, since it's really zero real evidence) sourceSummary text.
    expect(text).not.toContain("Confirmed across 0 entries");
  });

  test("shows a stale health badge for a rule present in resurfacedRules (REQ-LPC-19/20)", async () => {
    const rule = makeRule();
    const pattern = makePattern();
    const resurfaced: ResurfacedRule = {
      rule,
      pattern,
      reasons: ["stale"],
      staleness: { windowSize: 10 },
    };

    await act(async () => {
      root.render(
        <ProfileEditor
          initialProfile={makeProfile([rule])}
          resurfacedRules={[resurfaced]}
          patterns={[pattern]}
        />,
      );
    });
    await flushLinkEffects();

    expect(container.textContent ?? "").toContain("Stale");
  });

  test("dimension headings use the shared DIMENSION_LABELS map, not an ad-hoc replace()", async () => {
    const rule = makeRule({ dimension: "paragraph-structure" });

    await act(async () => {
      root.render(
        <ProfileEditor initialProfile={makeProfile([rule])} resurfacedRules={[]} patterns={[]} />,
      );
    });
    await flushLinkEffects();

    // The shared map renders "Paragraph Structure" (title case); the old
    // ad-hoc `dimension.replace(/-/g, " ")` would have produced the raw
    // lowercase-with-spaces key "paragraph structure" instead.
    expect(container.textContent ?? "").toContain("Paragraph Structure");
  });
});

import { describe, test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EntryNudge,
  formatRelativeTime,
  formatSavedLabel,
  toResultState,
} from "../components/entry-nudge";
import type { NudgeResponse } from "@ink-mirror/shared";

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

  test("appends ' — entry edited since' when stale", () => {
    expect(formatSavedLabel(tsTwoMin, true, now)).toBe(
      "Saved 2 minutes ago — entry edited since",
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

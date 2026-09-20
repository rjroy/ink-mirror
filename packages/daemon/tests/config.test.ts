import { describe, expect, test } from "bun:test";
import { loadConfig, DEFAULT_CONFIG } from "../src/config.js";

describe("loadConfig", () => {
  test("returns spec defaults when no env vars are set", () => {
    const config = loadConfig({});
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  test("defaults match the spec's research-informed constants", () => {
    expect(DEFAULT_CONFIG).toEqual({
      sightingThreshold: 3,
      distinctEntryThreshold: 3,
      wordCountThreshold: 2000,
      stalenessWindow: 10,
      computableWatchWindow: 5,
      qualitativeWatchWindow: 10,
      ledgerCap: 50,
      driftMargin: 0.5,
    });
  });

  test("every field is overridable via its INK_MIRROR_* env var", () => {
    const config = loadConfig({
      INK_MIRROR_SIGHTING_THRESHOLD: "5",
      INK_MIRROR_ENTRY_THRESHOLD: "4",
      INK_MIRROR_WORD_THRESHOLD: "1500",
      INK_MIRROR_STALENESS_WINDOW: "20",
      INK_MIRROR_COMPUTABLE_WATCH_WINDOW: "7",
      INK_MIRROR_QUALITATIVE_WATCH_WINDOW: "15",
      INK_MIRROR_LEDGER_CAP: "100",
      INK_MIRROR_DRIFT_MARGIN: "0.25",
    });

    expect(config).toEqual({
      sightingThreshold: 5,
      distinctEntryThreshold: 4,
      wordCountThreshold: 1500,
      stalenessWindow: 20,
      computableWatchWindow: 7,
      qualitativeWatchWindow: 15,
      ledgerCap: 100,
      driftMargin: 0.25,
    });
  });

  test("falls back to the default for a blank env var", () => {
    const config = loadConfig({ INK_MIRROR_LEDGER_CAP: "" });
    expect(config.ledgerCap).toBe(DEFAULT_CONFIG.ledgerCap);
  });

  test("falls back to the default for a non-numeric env var", () => {
    const config = loadConfig({ INK_MIRROR_DRIFT_MARGIN: "not-a-number" });
    expect(config.driftMargin).toBe(DEFAULT_CONFIG.driftMargin);
  });

  test("falls back to the default for non-finite overrides (NaN, Infinity)", () => {
    const config = loadConfig({
      INK_MIRROR_SIGHTING_THRESHOLD: "NaN",
      INK_MIRROR_LEDGER_CAP: "Infinity",
    });
    expect(config.sightingThreshold).toBe(DEFAULT_CONFIG.sightingThreshold);
    expect(config.ledgerCap).toBe(DEFAULT_CONFIG.ledgerCap);
    expect(Number.isNaN(config.sightingThreshold)).toBe(false);
    expect(Number.isFinite(config.ledgerCap)).toBe(true);
  });

  test("falls back to the default for a negative override", () => {
    const config = loadConfig({ INK_MIRROR_LEDGER_CAP: "-5" });
    expect(config.ledgerCap).toBe(DEFAULT_CONFIG.ledgerCap);
  });

  test("leaves unrelated env vars alone", () => {
    const config = loadConfig({ SOME_OTHER_VAR: "irrelevant" });
    expect(config).toEqual(DEFAULT_CONFIG);
  });
});

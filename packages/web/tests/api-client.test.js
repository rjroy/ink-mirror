import { describe, test, expect } from "bun:test";
import * as api from "../lib/api";
/**
 * Verifies the client-side API module exports the correct functions.
 * These functions call Next.js API routes which proxy to the daemon.
 */
describe("api client module", () => {
    test("exports createEntry", () => {
        expect(typeof api.createEntry).toBe("function");
    });
    test("exports listEntries", () => {
        expect(typeof api.listEntries).toBe("function");
    });
    test("exports getEntry", () => {
        expect(typeof api.getEntry).toBe("function");
    });
    test("exports getCurationSession", () => {
        expect(typeof api.getCurationSession).toBe("function");
    });
    test("exports classifyObservation", () => {
        expect(typeof api.classifyObservation).toBe("function");
    });
    test("exports getProfile", () => {
        expect(typeof api.getProfile).toBe("function");
    });
    test("exports updateProfileRule", () => {
        expect(typeof api.updateProfileRule).toBe("function");
    });
    test("exports deleteProfileRule", () => {
        expect(typeof api.deleteProfileRule).toBe("function");
    });
    test("exports replaceProfile", () => {
        expect(typeof api.replaceProfile).toBe("function");
    });
    test("exports subscribeObservations", () => {
        expect(typeof api.subscribeObservations).toBe("function");
    });
});

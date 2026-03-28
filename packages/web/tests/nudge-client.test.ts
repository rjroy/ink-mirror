import { describe, test, expect } from "bun:test";
import * as api from "../lib/api";

describe("nudge client function", () => {
  test("exports requestNudge", () => {
    expect(typeof api.requestNudge).toBe("function");
  });
});

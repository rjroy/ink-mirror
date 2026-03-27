import { describe, expect, test } from "bun:test";
import { entryId, observationId } from "../src/branded.js";

describe("branded IDs", () => {
  test("entryId wraps a string", () => {
    const id = entryId("entry-2026-03-27-001");
    expect(id).toBe("entry-2026-03-27-001" as unknown as typeof id);
    // At runtime it's still a string
    expect(typeof id).toBe("string");
  });

  test("observationId wraps a string", () => {
    const id = observationId("obs-2026-03-27-001");
    expect(id).toBe("obs-2026-03-27-001" as unknown as typeof id);
    expect(typeof id).toBe("string");
  });

  // Type-level test: these would fail to compile if brands leaked.
  // Can't test compile-time constraints at runtime, but the types exist
  // and the constructors produce the correct runtime values.
  test("different branded IDs have distinct values", () => {
    const eid = entryId("same-string");
    const oid = observationId("same-string");
    // Same runtime value, different compile-time types
    expect(eid).toBe("same-string" as unknown as typeof eid);
    expect(oid).toBe("same-string" as unknown as typeof oid);
  });
});

/* eslint-disable @typescript-eslint/require-await */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EntryReflection } from "../components/entry-reflection";
import { currentObservationsForEntry } from "../lib/current-observations";
import type { Observation } from "@ink-mirror/shared";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const previousStreams = {
  WritableStream: globalThis.WritableStream,
  ReadableStream: globalThis.ReadableStream,
  TransformStream: globalThis.TransformStream,
};

const previousObservation: Observation = {
  id: "obs-previous",
  entryId: "entry-2026-04-22-001",
  patternId: "pat-previous",
  pattern: "Previous accepted observation",
  evidence: ["Previous evidence."],
  dimension: "sentence-rhythm",
  validationStatus: "verified",
  validationWarnings: [],
  validationDiagnostics: [],
  createdAt: "2026-04-22T12:00:00.000Z",
  updatedAt: "2026-04-22T12:00:00.000Z",
};

const freshObservation: Observation = {
  ...previousObservation,
  id: "obs-fresh",
  patternId: "pat-fresh",
  pattern: "Fresh accepted observation",
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("EntryReflection", () => {
  let container: HTMLElement;
  let root: Root;
  let originalFetch: typeof globalThis.fetch;

  beforeAll(() => {
    GlobalRegistrator.register({ url: "http://localhost/" });
  });
  afterAll(async () => {
    await GlobalRegistrator.unregister();
    globalThis.WritableStream = previousStreams.WritableStream;
    globalThis.ReadableStream = previousStreams.ReadableStream;
    globalThis.TransformStream = previousStreams.TransformStream;
  });
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    originalFetch = globalThis.fetch;
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    globalThis.fetch = originalFetch;
  });

  function render(): Promise<void> {
    return act(async () => root.render(<EntryReflection entryId={previousObservation.entryId} initialObservations={[previousObservation]} />));
  }
  function click(): void {
    const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent === "Reflect again");
    if (!button) throw new Error("Reflect again button not found");
    button.click();
  }

  test("initiates only after click and shows pending state", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    globalThis.fetch = (() => new Promise<Response>((resolve) => { resolveFetch = resolve; })) as typeof globalThis.fetch;
    await render();
    expect(container.textContent).toContain("Previous accepted observation");
    expect(container.textContent).toContain("Reflect again");
    expect(container.textContent).not.toContain("Reflecting...");
    await act(async () => click());
    expect(container.textContent).toContain("Reflecting...");
    expect(container.textContent).toContain("Previous accepted observation");
    resolveFetch(response({ observations: [freshObservation], errors: [] }));
    await flush();
  });

  test("replaces observations after a successful reflection", async () => {
    globalThis.fetch = (async () => response({ observations: [freshObservation], errors: [] })) as typeof globalThis.fetch;
    await render();
    await act(async () => click());
    await flush();
    expect(container.textContent).toContain("Reflection updated.");
    expect(container.textContent).toContain("Fresh accepted observation");
    expect(container.textContent).not.toContain("Previous accepted observation");
  });

  test("shows warnings and accepted partial observations", async () => {
    globalThis.fetch = (async () => response({ observations: [freshObservation], errors: ["one candidate rejected"] })) as typeof globalThis.fetch;
    await render();
    await act(async () => click());
    await flush();
    expect(container.textContent).toContain("Reflection completed with warnings: one candidate rejected");
    expect(container.textContent).toContain("Fresh accepted observation");
  });

  test("shows errors without discarding prior accepted observations", async () => {
    globalThis.fetch = (async () => response({ error: "Observer unavailable" }, 502)) as typeof globalThis.fetch;
    await render();
    await act(async () => click());
    await flush();
    expect(container.textContent).toContain("Previous accepted observation");
    expect(container.textContent).toContain("API error 502");
  });
});

describe("currentObservationsForEntry", () => {
  test("keeps a re-reflection replacement after the detail view reloads", () => {
    const supersededObservation: Observation = {
      ...previousObservation,
      supersededAt: "2026-04-22T13:00:00.000Z",
    };

    expect(
      currentObservationsForEntry(
        [supersededObservation, freshObservation],
        previousObservation.entryId,
      ),
    ).toEqual([freshObservation]);
  });
});

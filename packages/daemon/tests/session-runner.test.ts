import { describe, expect, test } from "bun:test";
import {
  createSessionRunner,
  type SessionRequest,
  type SessionResponse,
  type QueryFn,
} from "../src/session-runner.js";

function failingQuery(errors: Error[], thenReturn: string): QueryFn {
  let call = 0;
  return async () => {
    if (call < errors.length) {
      const err = errors[call];
      call++;
      throw err;
    }
    return { content: thenReturn };
  };
}

function trackingQuery(response: string): QueryFn & { calls: SessionRequest[] } {
  const calls: SessionRequest[] = [];
  const fn = async (req: SessionRequest): Promise<SessionResponse> => {
    calls.push(req);
    return { content: response };
  };
  (fn as QueryFn & { calls: SessionRequest[] }).calls = calls;
  return fn as QueryFn & { calls: SessionRequest[] };
}

describe("session runner", () => {
  test("passes request to queryFn and returns response", async () => {
    const query = trackingQuery("hello");
    const runner = createSessionRunner({ queryFn: query });

    const result = await runner.run({
      system: "You are helpful.",
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result.content).toBe("hello");
    expect(query.calls).toHaveLength(1);
    expect(query.calls[0].system).toBe("You are helpful.");
    expect(query.calls[0].messages[0].content).toBe("Hi");
  });

  test("retries on transient errors", async () => {
    const query = failingQuery(
      [new Error("API overloaded")],
      "success after retry",
    );
    const runner = createSessionRunner({ queryFn: query, maxRetries: 2 });

    const result = await runner.run({
      system: "sys",
      messages: [{ role: "user", content: "test" }],
    });

    expect(result.content).toBe("success after retry");
  });

  test("throws non-transient errors immediately", async () => {
    const query = failingQuery(
      [new Error("invalid_api_key")],
      "never reached",
    );
    const runner = createSessionRunner({ queryFn: query, maxRetries: 2 });

    expect(
      runner.run({
        system: "sys",
        messages: [{ role: "user", content: "test" }],
      }),
    ).rejects.toThrow("invalid_api_key");
  });

  test("exhausts retries and throws", async () => {
    const query = failingQuery(
      [new Error("rate limit"), new Error("rate limit"), new Error("rate limit")],
      "never reached",
    );
    const runner = createSessionRunner({ queryFn: query, maxRetries: 2 });

    expect(
      runner.run({
        system: "sys",
        messages: [{ role: "user", content: "test" }],
      }),
    ).rejects.toThrow("rate limit");
  });

  test("passes maxTokens through to queryFn", async () => {
    const query = trackingQuery("ok");
    const runner = createSessionRunner({ queryFn: query });

    await runner.run({
      system: "sys",
      messages: [{ role: "user", content: "test" }],
      maxTokens: 512,
    });

    expect(query.calls[0].maxTokens).toBe(512);
  });
});

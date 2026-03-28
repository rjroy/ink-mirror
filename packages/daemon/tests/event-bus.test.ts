import { describe, expect, test } from "bun:test";
import { createEventBus } from "../src/event-bus.js";

describe("EventBus", () => {
  test("emits events to subscribers", () => {
    const bus = createEventBus();
    const received: string[] = [];

    bus.subscribe<string>("test-topic", (event) => {
      received.push(event);
    });

    bus.emit("test-topic", "hello");
    bus.emit("test-topic", "world");

    expect(received).toEqual(["hello", "world"]);
  });

  test("does not deliver events to unrelated topics", () => {
    const bus = createEventBus();
    const received: string[] = [];

    bus.subscribe<string>("topic-a", (event) => {
      received.push(event);
    });

    bus.emit("topic-b", "should-not-arrive");

    expect(received).toEqual([]);
  });

  test("unsubscribe stops delivery", () => {
    const bus = createEventBus();
    const received: string[] = [];

    const unsub = bus.subscribe<string>("topic", (event) => {
      received.push(event);
    });

    bus.emit("topic", "before");
    unsub();
    bus.emit("topic", "after");

    expect(received).toEqual(["before"]);
  });

  test("multiple subscribers receive the same event", () => {
    const bus = createEventBus();
    const receivedA: string[] = [];
    const receivedB: string[] = [];

    bus.subscribe<string>("topic", (e) => receivedA.push(e));
    bus.subscribe<string>("topic", (e) => receivedB.push(e));

    bus.emit("topic", "shared");

    expect(receivedA).toEqual(["shared"]);
    expect(receivedB).toEqual(["shared"]);
  });

  test("subscriberCount tracks active subscribers", () => {
    const bus = createEventBus();

    expect(bus.subscriberCount("topic")).toBe(0);

    const unsub1 = bus.subscribe("topic", () => {});
    expect(bus.subscriberCount("topic")).toBe(1);

    const unsub2 = bus.subscribe("topic", () => {});
    expect(bus.subscriberCount("topic")).toBe(2);

    unsub1();
    expect(bus.subscriberCount("topic")).toBe(1);

    unsub2();
    expect(bus.subscriberCount("topic")).toBe(0);
  });

  test("emitting to topic with no subscribers is a no-op", () => {
    const bus = createEventBus();
    // Should not throw
    bus.emit("nonexistent", { data: "test" });
  });

  test("handles typed events", () => {
    const bus = createEventBus();

    interface EntryCreated {
      id: string;
      timestamp: number;
    }

    const received: EntryCreated[] = [];

    bus.subscribe<EntryCreated>("entry.created", (event) => {
      received.push(event);
    });

    bus.emit<EntryCreated>("entry.created", {
      id: "entry-001",
      timestamp: Date.now(),
    });

    expect(received).toHaveLength(1);
    expect(received[0].id).toBe("entry-001");
  });
});

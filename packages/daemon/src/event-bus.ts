import type { EventBus, EventHandler } from "./types.js";

/**
 * Simple set-based pub/sub. Each topic has a Set of handlers.
 * Handlers are invoked synchronously in registration order.
 * Returns an unsubscribe function.
 */
export function createEventBus(): EventBus {
  const topics = new Map<string, Set<EventHandler>>();

  return {
    emit<T>(topic: string, event: T): void {
      const handlers = topics.get(topic);
      if (!handlers) return;
      for (const handler of handlers) {
        (handler as EventHandler<T>)(event);
      }
    },

    subscribe<T>(topic: string, handler: EventHandler<T>): () => void {
      let handlers = topics.get(topic);
      if (!handlers) {
        handlers = new Set();
        topics.set(topic, handlers);
      }
      handlers.add(handler as EventHandler);
      return () => {
        handlers.delete(handler as EventHandler);
        if (handlers.size === 0) {
          topics.delete(topic);
        }
      };
    },

    subscriberCount(topic: string): number {
      return topics.get(topic)?.size ?? 0;
    },
  };
}

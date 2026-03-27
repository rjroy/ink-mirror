import type { EventBus } from "./types.js";
/**
 * Simple set-based pub/sub. Each topic has a Set of handlers.
 * Handlers are invoked synchronously in registration order.
 * Returns an unsubscribe function.
 */
export declare function createEventBus(): EventBus;
//# sourceMappingURL=event-bus.d.ts.map
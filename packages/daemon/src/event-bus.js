/**
 * Simple set-based pub/sub. Each topic has a Set of handlers.
 * Handlers are invoked synchronously in registration order.
 * Returns an unsubscribe function.
 */
export function createEventBus() {
    const topics = new Map();
    return {
        emit(topic, event) {
            const handlers = topics.get(topic);
            if (!handlers)
                return;
            for (const handler of handlers) {
                handler(event);
            }
        },
        subscribe(topic, handler) {
            let handlers = topics.get(topic);
            if (!handlers) {
                handlers = new Set();
                topics.set(topic, handlers);
            }
            handlers.add(handler);
            return () => {
                handlers.delete(handler);
                if (handlers.size === 0) {
                    topics.delete(topic);
                }
            };
        },
        subscriberCount(topic) {
            return topics.get(topic)?.size ?? 0;
        },
    };
}

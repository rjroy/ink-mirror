import { Hono } from "hono";
import type { OperationDefinition } from "@ink-mirror/shared";

/**
 * Every route file exports a factory that returns a RouteModule.
 * The Hono app fragment gets mounted; the operations feed the registry.
 */
export interface RouteModule {
  routes: Hono;
  operations: OperationDefinition[];
}

/**
 * EventBus subscriber callback.
 */
export type EventHandler<T = unknown> = (event: T) => void;

/**
 * Typed event bus interface. Services emit events on state transitions.
 * SSE routes subscribe to stream events to clients.
 */
export interface EventBus {
  emit<T>(topic: string, event: T): void;
  subscribe<T>(topic: string, handler: EventHandler<T>): () => void;
  subscriberCount(topic: string): number;
}

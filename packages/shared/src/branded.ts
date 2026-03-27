/**
 * Branded types prevent mixing ID namespaces at compile time.
 * A function expecting EntryId won't accept an ObservationId,
 * even though both are strings at runtime.
 */

declare const brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [brand]: B };

export type EntryId = Brand<string, "EntryId">;
export type ObservationId = Brand<string, "ObservationId">;

export function entryId(id: string): EntryId {
  return id as EntryId;
}

export function observationId(id: string): ObservationId {
  return id as ObservationId;
}

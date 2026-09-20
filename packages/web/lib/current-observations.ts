import type { Observation } from "@ink-mirror/shared";

/** Select the accepted observation set current for an entry's detail view. */
export function currentObservationsForEntry(
  observations: Observation[],
  entryId: string,
): Observation[] {
  return observations.filter(
    (observation) => observation.entryId === entryId && !observation.supersededAt,
  );
}

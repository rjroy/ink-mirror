/**
 * Fixed multi-entry corpus fixture for substrate/snapshot determinism
 * testing (plan: Phase 2 gate — "New multi-entry corpus fixture convention
 * established here"). Content and dates are hand-picked and never change:
 * any test built on this fixture should keep passing byte-for-byte across
 * runs and across phases. Later phases (pattern ledger, curation,
 * promotion) reuse this same fixture so their sightings/dossiers line up
 * against the same entry IDs and dates.
 *
 * Deliberately varied per entry: punctuation density rises across the
 * corpus (comma/dash/colon/question/parenthesis/ellipsis all appear),
 * giving trend/drift tests something real to detect, alongside hedging
 * words and short/long sentence mixes for the existing metrics.
 */
export interface CorpusEntryFixture {
  entryId: string;
  date: string;
  text: string;
}

export const CORPUS_FIXTURE: CorpusEntryFixture[] = [
  {
    entryId: "entry-2026-01-01-001",
    date: "2026-01-01T09:00:00.000Z",
    text: "I stopped. I turned. I left.",
  },
  {
    entryId: "entry-2026-01-02-001",
    date: "2026-01-02T09:00:00.000Z",
    text: "The kitchen smelled like burnt toast, and I didn't mind.",
  },
  {
    entryId: "entry-2026-01-03-001",
    date: "2026-01-03T09:00:00.000Z",
    text: "I think I probably left the stove on again, sort of on purpose, if I'm honest.",
  },
  {
    entryId: "entry-2026-01-04-001",
    date: "2026-01-04T09:00:00.000Z",
    text: "The room was quiet - too quiet - and I noticed everything: the clock, the draft, the silence.",
  },
  {
    entryId: "entry-2026-01-05-001",
    date: "2026-01-05T09:00:00.000Z",
    text: "Was it really that bad? I wondered, half-laughing, half-serious (though I never said so out loud).",
  },
  {
    entryId: "entry-2026-01-06-001",
    date: "2026-01-06T09:00:00.000Z",
    text: "It happened again... the same feeling, the same silence, the same, familiar ache.",
  },
];

---
title: "Review: Phase 1B Journal Entry Storage"
date: 2026-03-27
status: resolved
reviewer: Thorne
resolver: Dalton
tags: [review, phase-1b, entries]
---

# Phase 1B Review: Journal Entry Storage

## Requirement Compliance
All 6 requirements satisfied: REQ-V1-1 (free-form), REQ-V1-2 (markdown+frontmatter), REQ-V1-3 (readable without app), REQ-V1-24 (daemon authority), REQ-V1-25 (CLI first-class), REQ-V1-26 (human-readable files).

## Findings

### Defects (3)

**F-01: Path traversal in entry retrieval.** RESOLVED.
`GET /entries/:id` passed raw URL param to `path.join`. Added ID format validation (`/^entry-[\w-]+$/`) in the route handler. Returns 400 for invalid IDs.

**F-02: `ink-mirror entries` shows help instead of listing entries.** RESOLVED.
Root cause: registry placed operations 3 levels deep (root > rootName > feature > ops). Flattened to 2 levels (root > rootName > ops). Added "list" as default operation when multiple operations exist on a node and no args remain.

**F-03: Race condition in sequential ID generation.** RESOLVED.
Added `exists()` method to `EntryStoreFs` interface. `create()` now checks if the target file already exists before writing and increments the sequence number if it does.

### Concerns (2)

**F-04: Title quoting in frontmatter is fragile.** RESOLVED.
`toMarkdown` now escapes backslashes and double quotes in titles. `fromMarkdown` updated to parse escaped sequences. Tests added for titles with special characters.

**F-05: No YAML parser for frontmatter.** DEFERRED.
Adding a YAML library for 3 fields is premature. The quoting fix (F-04) addresses the immediate fragility. Revisit before Phase 2 if more frontmatter fields are added.

### Observations (2)

**F-06: `write` command can't set a title.** ACKNOWLEDGED.
UX gap, not a spec violation. Can be addressed in a future pass.

**F-07: `entries.create` operation missing `title` parameter.** RESOLVED.
Added optional `title` parameter to the operation definition. Tests updated to verify.

## Test Coverage
- Path traversal rejection test added (entry-routes)
- Title with special characters round-trip tests added (entry-store)
- Operation parameter count test updated (entry-routes)
- Registry tests updated for flattened tree structure
- Discovery tests updated with new tree shape and "entries alone resolves to list" test
- All runnable tests pass (npm registry unavailable in this environment prevents full suite)

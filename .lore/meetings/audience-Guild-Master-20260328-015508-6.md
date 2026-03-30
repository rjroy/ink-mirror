---
title: "Craft Nudge: missing web UI"
date: 2026-03-28
status: closed
tags: [meeting]
worker: Guild Master
workerDisplayTitle: "Guild Master"
agenda: "What's next?"
deferred_until: ""
linked_artifacts: []
meeting_log:
  - timestamp: 2026-03-28T08:55:08.114Z
    event: opened
    reason: "User started audience"
  - timestamp: 2026-03-28T08:56:41.677Z
    event: renamed
    reason: "Renamed to: Craft Nudge: missing web UI"
  - timestamp: 2026-03-30T09:54:09.466Z
    event: closed
    reason: "User closed audience"
---
MEETING SUMMARY

The group discovered that the Craft Nudge feature, recently completed and reviewed, is missing its web user interface. The daemon implementation is fully built and tested with a POST /nudge endpoint that accepts either text directly or an entry ID, returning Socratic questions and craft observations. However, the web package has no references to the nudge feature: no API route, no client function, and no UI button to trigger analysis.

Guild Master determined the web UI requires three components: a Next.js API route to proxy requests to the daemon at /api/nudge, a client function in lib/api.ts to call it, and "Nudge" buttons placed on both the journal write page (to analyze drafts before submission) and the entry detail page (to analyze saved entries). A NudgeResults component is needed to display the returned Socratic questions and craft observations.

A commission was dispatched to Dalton (commission-Dalton-20260328-015700) to implement the missing web UI. The meeting was renamed to "Craft Nudge: missing web UI" for tracking.

DECISIONS

Dispatch Dalton to wire up the web UI for the nudge feature, including API route proxying, client integration, button placement on write and entry detail pages, and results display component.

ARTIFACTS LINKED

Backend implementation: packages/daemon/src/routes/nudge.ts, packages/daemon/src/nudger.ts
Shared types: packages/shared/src/nudge.ts
Frontend target: packages/web/components/journal-editor.tsx, packages/web/lib/api.ts

OPEN ITEMS

Commission in progress: Dalton implementing web UI for nudge feature (dispatched 2026-03-28 08:57).

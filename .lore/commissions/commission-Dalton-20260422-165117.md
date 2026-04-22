---
title: "Commission: Phase 5A: Build web client nudge persistence UX"
date: 2026-04-22
status: blocked
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Implement Phase 5A of `.lore/plans/craft-nudge-persistence.md`.\n\nSpec: `.lore/specs/craft-nudge-persistence.md`\nPlan: `.lore/plans/craft-nudge-persistence.md` (see \"Phase 5: Web Surface\" → \"Commission 5A\")\n\n**Critical reminder**: There is no mount-fetch, no GET endpoint, no `getSavedNudge` helper. The component does nothing until the user clicks the Nudge button. This was corrected in a recent spec/plan revision — read Phase 5A's scope in the plan carefully.\n\nScope:\n- Extend `requestNudge` in `packages/web/lib/api.ts` with `refresh?: boolean`.\n- Update `packages/web/components/entry-nudge.tsx`: single user-initiated click → POST. After any result (cache or fresh), render nudges + \"Saved {relativeTime}\" label (+ \" — entry edited since\" when `stale: true`) + \"Regenerate\" button. Regenerate POSTs with `refresh: true`.\n- Add CSS for Saved label + Regenerate button in `entry-nudge.module.css`.\n- Abort-on-unmount guard so in-flight POSTs don't call setState on unmounted component.\n- Tests per the plan's Phase 5A test list.\n\nOut of scope: other entry-view UI changes, profile integration, observer display, mount fetches of any kind.\n\nVerify:\n```\nbun test packages/web\nbun run typecheck\nbun run lint\n```\n\nAll must pass. Manual spot-check in dev server per spec AI Validation note."
dependencies:
  - commission-Dalton-20260422-165050
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-04-22T23:51:17.489Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-22T23:51:17.491Z
    event: status_blocked
    reason: "Dependencies not satisfied"
    from: "pending"
    to: "blocked"
current_progress: ""
projectName: ink-mirror
---

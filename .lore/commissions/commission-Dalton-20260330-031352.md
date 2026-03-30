---
title: "Commission: Fix iOS keyboard zoom/resize in web UI"
date: 2026-03-30
status: dispatched
type: one-shot
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Fix an iOS Safari issue in the web package where the viewport zooms/resizes when the on-screen keyboard opens.\n\n**Problem:** On iOS, when the keyboard pops up, the page zooms in slightly and the layout resizes. The UX should remain stable when the keyboard appears.\n\n**Likely fixes (investigate and apply what's needed):**\n\n1. **Viewport meta tag** in `app/layout.tsx` (or wherever the HTML head is configured): ensure `maximum-scale=1` and `user-scalable=no` are set. Something like:\n   ```html\n   <meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no\" />\n   ```\n\n2. **CSS `viewport-fit=cover`** may also be needed in the viewport meta for proper safe-area handling.\n\n3. **Visual Viewport API or CSS fixes**: iOS Safari's virtual keyboard can push content. Consider using `dvh` (dynamic viewport height) units or the `visualViewport` API if layout shifts are happening beyond just the zoom.\n\n4. **`interactive-widget=resizes-content` or `resizes-visual`** meta tag option (newer browsers).\n\n**Scope:** This is a small, targeted fix. Find the right file(s) in `packages/web/`, apply the fix, and verify the viewport meta tag is correct. Run `bun run typecheck` and `bun test` to make sure nothing breaks."
dependencies: []
linked_artifacts: []

resource_overrides:
  model: sonnet

activity_timeline:
  - timestamp: 2026-03-30T10:13:52.931Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-30T10:13:52.933Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---

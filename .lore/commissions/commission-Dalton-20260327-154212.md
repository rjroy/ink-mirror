---
title: "Commission: DX cleanup: web layer visual alignment"
date: 2026-03-27
status: dispatched
type: one-shot
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Implement Commission 3 from `.lore/plans/dx-cleanup.md` — apply Sienna's visual direction to the web layer.\n\n**Reference files (read these first):**\n- `.lore/art/visual-direction.md` — palette, typography, texture rules, layout wireframe\n- `.lore/art/journal-screen-mockup.html` — complete CSS implementation to match\n\n**Sub-commissions (3A through 3F):**\n\n**3A: Global styles and layout shell**\n- Create `packages/web/app/globals.css` with CSS custom properties from the plan (all palette colors, reset styles)\n- Update `packages/web/app/layout.tsx` to import globals.css, remove any inline styles\n\n**3B: Nav component**\n- Restyle `packages/web/components/nav.tsx` to match the mockup header (52px, italic serif wordmark, uppercase nav items)\n- Create `packages/web/components/nav.module.css`\n\n**3C: Write page (journal editor)**\n- Restyle `packages/web/components/journal-editor.tsx` to match the mockup editor\n- Remove the title input field (entries auto-date)\n- Georgia serif 18px/1.85, generous padding, \"Observe →\" button replacing \"Submit Entry\"\n- Create `packages/web/components/journal-editor.module.css`\n\n**3D: Entry detail page**\n- Restyle `packages/web/app/entries/[id]/page.tsx` for the two-pane layout when observations exist\n- Observation cards: 3px left border in observer-border, serif italic evidence blocks, classification buttons\n\n**3E: Entries list page**\n- Apply palette to `packages/web/app/entries/page.tsx` (card borders, date styling, preview text)\n\n**3F: Curate and Profile pages**\n- Apply palette to curate and profile pages and their components\n- Create CSS modules for curation-panel and profile-editor\n\n**Implementation approach:** CSS modules alongside components. No CSS framework. All colors via CSS custom properties. No shadows, no gradients, no border-radius larger than 4px.\n\n**Verification:**\n- `/write` page visually matches `journal-screen-mockup.html`\n- No hardcoded color values remain in components\n- Typography: editor is Georgia serif 18px/1.85, UI chrome is system sans 11-13px\n- Mobile: observation panel stacks below editor at narrow viewports\n- `bun run build` still succeeds after all changes"
dependencies: []
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-03-27T22:42:12.040Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-27T22:42:12.042Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---

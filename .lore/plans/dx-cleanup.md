---
title: "Plan: DX Cleanup and Visual Alignment"
date: 2026-03-27
status: executed
tags: [plan, dx, scripts, visual-direction, web]
---

# Plan: DX Cleanup and Visual Alignment

## Overview

Four independent commissions. No ordering dependencies between them, so they can run in parallel or any sequence. Each is self-contained: the files it touches, the exact changes, and how to verify.

## Commission 1: Root Scripts and Daemon Dev Mode

**Goal:** `bun run dev`, `bun run start`, and `bun run build` work from the repo root. The daemon gets a file-watching dev mode.

### Concurrency approach

Use shell `&` with `wait`. No new dependency needed. Bun runs in a bash shell on Linux, and backgrounding with `&` is the simplest reliable option for two long-running processes. The `concurrently` package adds color-coded output and process management, but that's overhead for a single-user dev tool with two processes. If output interleaving becomes annoying later, add `concurrently` then.

A `trap` ensures child processes clean up on Ctrl+C.

### Changes

**`packages/daemon/package.json`** — add `dev` script:

```json
"scripts": {
  "start": "bun run src/index.ts",
  "dev": "bun --watch run src/index.ts",
  "test": "bun test"
}
```

`bun --watch` restarts the process on file changes within the package. Native to bun, no dependency needed.

**`package.json` (root)** — add three scripts:

```json
"scripts": {
  "test": "bun test packages/shared packages/daemon/tests packages/cli/tests packages/web/tests",
  "lint": "eslint .",
  "typecheck": "tsc --build",
  "dev": "trap 'kill 0' EXIT; bun run --filter '@ink-mirror/daemon' dev & bun run --filter '@ink-mirror/web' dev & wait",
  "start": "trap 'kill 0' EXIT; bun run --filter '@ink-mirror/daemon' start & bun run --filter '@ink-mirror/web' start & wait",
  "build": "bun run --filter '@ink-mirror/web' build"
}
```

`bun run --filter` runs a package script by workspace name. This avoids `cd packages/web && ...` chains and stays idiomatic to bun workspaces.

### Verification

1. `bun run dev` starts both daemon and web dev servers. Daemon logs its socket path, web logs its dev URL.
2. Ctrl+C kills both processes (no orphaned bun processes).
3. `bun run build` produces `.next/` in `packages/web/`.
4. `bun run start` runs production mode (daemon on socket, web on port 3000).

---

## Commission 2: CLI Documentation

**Goal:** A developer can figure out how to use the CLI without reading source code.

### Changes

**`README.md` (repo root)** — create with the following structure:

```markdown
# ink-mirror

A writing self-awareness tool. Write journal entries, receive observations about your writing patterns, and curate those observations over time.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.2+
- An Anthropic API key (set `ANTHROPIC_API_KEY` in your environment)

### Development

```bash
bun install
bun run dev        # starts daemon + web dev server
```

The web UI is at http://localhost:3000. The daemon listens on a Unix socket at `/tmp/ink-mirror.sock`.

### CLI

The CLI discovers its commands from the daemon at runtime. The daemon must be running first.

```bash
# In one terminal:
bun run dev

# In another terminal:
bun run --filter @ink-mirror/cli start           # show available commands
bun run --filter @ink-mirror/cli start -- write   # write a journal entry ($EDITOR)
bun run --filter @ink-mirror/cli start -- curate  # classify pending observations
bun run --filter @ink-mirror/cli start -- profile  # view your style profile
```

The CLI connects to the daemon via Unix socket. If the daemon isn't running, the CLI prints a connection error with the expected socket path.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `INK_MIRROR_SOCKET` | `/tmp/ink-mirror.sock` | Unix socket path for daemon |
| `INK_MIRROR_DATA` | `~/.ink-mirror` | Data directory for entries and observations |
| `ANTHROPIC_API_KEY` | (required) | API key for observation generation |

### Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start daemon + web in development mode |
| `bun run start` | Start daemon + web in production mode |
| `bun run build` | Build the web package |
| `bun test` | Run all tests |
| `bun run lint` | Lint all packages |
| `bun run typecheck` | TypeScript type checking |
```

### Verification

1. A new contributor can follow the README to get the system running.
2. CLI commands listed in the README match what `bun run --filter @ink-mirror/cli start` actually outputs.

---

## Commission 3: Web Layer Visual Alignment

**Goal:** Apply Sienna's visual direction to the web layer. The app should look like the journal-screen-mockup.html, not a default unstyled Next.js app.

### Approach: CSS custom properties in a global stylesheet

The visual direction defines a complete color palette, typography stack, and spacing system. CSS custom properties are the right tool: they centralize the palette, they're used in the HTML mockup already, and they avoid runtime overhead.

No CSS framework (Tailwind, etc.). The visual direction is specific enough that utility classes add indirection without value. Plain CSS modules or a global stylesheet matches the mockup's approach.

### Reference files

- `.lore/art/visual-direction.md` — palette, typography, texture rules, layout wireframe
- `.lore/art/journal-screen-mockup.html` — complete CSS implementation of the journal entry screen

### Changes

#### 3A: Global styles and layout shell

**`packages/web/app/globals.css`** — create. Extract the `:root` variables and base styles from the mockup:

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg: #f5f0e8;
  --surface: #faf8f4;
  --ink: #1c1b18;
  --ink-muted: #6b6760;
  --ink-faint: #9e9a94;
  --border: #e2dcd2;
  --border-light: #ece8e0;
  --observer-bg: #eee9df;
  --observer-accent: #4a5c70;
  --observer-border: #8fa0b4;
  --observer-faint: #6b7f94;
  --observer-evidence: #3d4f60;
  --intent-bg: #f0f3ee;
  --intent-border: #7a9070;
  --accid-bg: #f5eeee;
  --accid-border: #9a7070;
  --undecided-bg: #f0eff5;
  --undecided-border: #7a7a9a;
}

body {
  font-family: -apple-system, 'Helvetica Neue', sans-serif;
  background: var(--bg);
  color: var(--ink);
  min-height: 100vh;
}
```

**`packages/web/app/layout.tsx`** — import globals.css, restructure to match mockup header:

```tsx
import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "ink-mirror",
  description: "A writing self-awareness tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
```

Remove the inline `style` attributes from `<body>` and `<main>`. The global CSS handles both.

#### 3B: Nav component

**`packages/web/components/nav.tsx`** — restyle to match the mockup's `.app-header`:

The mockup uses a 52px header with the italic serif wordmark on the left and uppercase nav items on the right. Key properties:

- `height: 52px`, `padding: 0 48px`
- `border-bottom: 1px solid var(--border)`
- `background: var(--bg)`
- Wordmark: `font-family: Georgia, serif`, `font-style: italic`, `font-size: 15px`
- Nav items: `font-size: 12px`, `text-transform: uppercase`, `letter-spacing: 0.06em`, `color: var(--ink-faint)` (active: `var(--ink-muted)` with bottom border)

Replace inline styles with CSS (either a CSS module `nav.module.css` or inline styles using the variables). CSS module is cleaner for this volume of styling.

The mockup nav labels are "journal / review / profile". The current nav has "Write / Entries / Curate / Profile". Keep the current labels (they match the actual routes), but apply the mockup's visual treatment.

#### 3C: Write page (journal editor)

**`packages/web/app/write/page.tsx`** and **`packages/web/components/journal-editor.tsx`** — restyle to match the mockup's editor pane.

Key changes to journal-editor.tsx:
- Remove the title input field (the mockup has no title field; entries auto-date)
- Editor area: `font-family: Georgia, serif`, `font-size: 18px`, `line-height: 1.85`, `max-width: 640px`
- Generous padding: `52px 72px 40px 80px` on the editor pane
- Background: `var(--surface)` (near-white)
- Footer: word count on left (`font-size: 11px`, `color: var(--ink-faint)`), "Observe" button on right (subtle border, not a filled button)
- Date display above the editor: `font-size: 12px`, uppercase, `letter-spacing: 0.07em`, `color: var(--ink-faint)`
- `textarea::selection` uses the observer accent at low opacity: `rgba(74, 92, 112, 0.12)`

The "Observe" button replaces "Submit Entry". The label should be `Observe →` per the mockup.

Note: the title input removal is a visual alignment decision. The daemon API accepts an optional title. Removing the field from the UI is correct per the mockup (entries are identified by date), but the API contract doesn't change.

#### 3D: Entry detail page with observation panel

**`packages/web/app/entries/[id]/page.tsx`** — restyle to the two-pane layout from the mockup when observations exist.

- Without observations: full-width editor-style layout (serif text, generous spacing)
- With observations: 65/35 split. Left pane shows entry text. Right pane shows observation cards.
- Observation cards: `var(--surface)` background, `1px solid var(--border)`, `3px left border in var(--observer-border)`
- Dimension labels: `9px`, uppercase, `letter-spacing: 0.1em`, `color: var(--observer-faint)`
- Evidence blocks: serif italic, slightly smaller than body, left-bordered
- Classification buttons: small, subdued, using the intent/accidental/undecided color sets from the palette

#### 3E: Entries list page

**`packages/web/app/entries/page.tsx`** — restyle entry cards.

- Card borders: `1px solid var(--border)` instead of `#e5e5e5`
- Date: `var(--ink-faint)`, small uppercase
- Preview: `var(--ink-muted)`
- Generous padding, no border-radius larger than 4px
- Empty state message uses `var(--ink-muted)` instead of `#666`

#### 3F: Curate and Profile pages

**`packages/web/app/curate/page.tsx`** and **`packages/web/app/profile/page.tsx`** — apply palette to page shells. Update heading styles to match the visual direction (no need for full redesigns, just palette alignment).

**`packages/web/components/curation-panel.tsx`** and **`packages/web/components/profile-editor.tsx`** — replace hardcoded colors with CSS variables. Apply the observation card styling from the mockup to any observation display in the curation panel.

### Styling implementation note

Use CSS modules (`*.module.css`) alongside the components rather than inline styles. The mockup's CSS is specific enough to translate directly. Each component gets its own module:
- `components/nav.module.css`
- `components/journal-editor.module.css`
- `components/curation-panel.module.css`
- `components/profile-editor.module.css`

Page-level styles can go in colocated CSS modules or use the global CSS variables with minimal inline styles.

### Verification

1. Visual comparison: the `/write` page should closely match `journal-screen-mockup.html` when viewed in a browser.
2. No hardcoded color values remain in components. All colors reference CSS custom properties.
3. Typography: editor text is Georgia serif at 18px/1.85. UI chrome is system sans-serif at 11-13px.
4. No shadows, no gradients, no border-radius larger than 4px.
5. Mobile: observation panel stacks below the editor (column layout) at narrow viewports.

---

## Commission 4: Remaining Cleanup

Reserved for anything surfaced during Commissions 1-3. Not pre-scoped.

---

## File Change Summary

| File | Commission | Action |
|------|-----------|--------|
| `package.json` (root) | 1 | Edit: add dev/start/build scripts |
| `packages/daemon/package.json` | 1 | Edit: add dev script |
| `README.md` (root) | 2 | Create |
| `packages/web/app/globals.css` | 3A | Create |
| `packages/web/app/layout.tsx` | 3A | Edit: import globals.css, remove inline styles |
| `packages/web/components/nav.tsx` | 3B | Edit: restyle to mockup header |
| `packages/web/components/nav.module.css` | 3B | Create |
| `packages/web/app/write/page.tsx` | 3C | Edit: remove h1, adjust layout |
| `packages/web/components/journal-editor.tsx` | 3C | Edit: restyle to mockup editor |
| `packages/web/components/journal-editor.module.css` | 3C | Create |
| `packages/web/app/entries/page.tsx` | 3E | Edit: apply palette |
| `packages/web/app/entries/[id]/page.tsx` | 3D | Edit: two-pane layout with observation cards |
| `packages/web/app/curate/page.tsx` | 3F | Edit: apply palette |
| `packages/web/app/profile/page.tsx` | 3F | Edit: apply palette |
| `packages/web/components/curation-panel.tsx` | 3F | Edit: apply palette and card styling |
| `packages/web/components/curation-panel.module.css` | 3F | Create |
| `packages/web/components/profile-editor.tsx` | 3F | Edit: apply palette |
| `packages/web/components/profile-editor.module.css` | 3F | Create |

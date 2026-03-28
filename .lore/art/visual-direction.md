---
title: ink-mirror Visual Direction
date: 2026-03-27
status: approved
tags: [visual, design, art-direction]
---

# ink-mirror Visual Direction

## Summary

ink-mirror is a personal, reflective writing tool. Its visual language should feel like a well-made notebook: quiet, confident, and intimate. The interface exists to get out of the way so writing can happen. When the observer speaks, it speaks with a different voice — not a correction, but a note in the margin.

The central metaphor is the mirror: seeing yourself clearly, without judgment. This shows up in the icon, in the color palette (ink and its reflection), and in the way observation cards present themselves — they're not from a red pen, they're from a thoughtful reader.

---

## Palette

| Role | Value | Usage |
|------|-------|-------|
| Background | `#f5f0e8` | Page, app background — warm cream |
| Surface | `#faf8f4` | Editor area — near-white paper |
| Ink | `#1c1b18` | Body text — near-black, not pure black |
| Ink muted | `#6b6760` | Date, metadata, labels |
| Ink faint | `#9e9a94` | Word count, secondary UI |
| Border | `#e2dcd2` | Dividers, card borders |
| Observer bg | `#eee9df` | Observation panel — slightly deeper cream |
| Observer accent | `#4a5c70` | Observation border-left, observer voice color |
| Observer border | `#8fa0b4` | Observation card highlight border |

**Rationale:** The two-register palette (warm cream / slate blue) encodes the core concept: the writer's words are warm, handmade, direct. The observer's notes are cooler, more analytical — like marginalia written in a different ink. The slate blue doesn't shout; it's a reading light, not a spotlight.

**What to avoid:** Bright white backgrounds (too sterile, no warmth), strong saturated colors, gradients, shadows heavier than 1px borders.

---

## Typography

- **Writing area:** Serif (Georgia or similar). 18px, 1.85 line-height. The text should feel like it belongs on paper.
- **UI chrome / labels:** System sans-serif (`-apple-system`, `Helvetica Neue`). 11–13px. Stays invisible.
- **Wordmark:** Serif italic. `font-style: italic`. Modest size — this is not a headline.
- **Observation dimension labels:** Small-caps uppercase, tracked wide (letter-spacing 0.10em). Signals "this is a different voice."
- **Observation evidence (quoted text):** Serif italic, slightly smaller than body. The reader is showing you your own words.

**Guiding principle:** The editor's serif type and the observer's sans-serif labels should feel like two different speakers — the writer and the reader — sharing the same page.

---

## Texture and Tone

- Subtle paper texture is desirable but not required (cream background approximates it without CSS overhead).
- No drop shadows. No card elevation. Flat surfaces, separated by hairline borders.
- No icons in the initial web version. Typography-driven UI.
- Spacing is generous. The editor area doesn't fill a grid — it breathes.

---

## Layout: Journal Entry Screen

See `journal-screen-mockup.html` for the precise HTML/CSS implementation and `mockup-journal-screen.png` for a rendered approximation.

**Desktop (1440px):**

```
┌─────────────────────────────────────────────────────────┐
│  ink-mirror                journal / review / profile   │  ← 52px header
├────────────────────────────────────┬────────────────────┤
│                                    │  OBSERVATIONS      │
│   Friday, March 27, 2026           │  ─────────────     │
│                                    │  ┌──────────────┐  │
│   [entry text in Georgia serif,    │  │ SENTENCE      │  │
│    generous line-height, cursor    │  │ RHYTHM        │  │
│    blinking at end]                │  │               │  │
│                                    │  │ [observation] │  │
│                                    │  │               │  │
│                                    │  │ "cited text"  │  │
│                                    │  │               │  │
│                                    │  │ [Intentional] │  │
│                                    │  │ [Accidental]  │  │
│                                    │  │ [Undecided]   │  │
│                                    │  └──────────────┘  │
│              152 words  Observe →  │  (2 more cards)    │
└────────────────────────────────────┴────────────────────┘
         ~65% width                      ~35% width
```

**Key decisions:**

- The observation panel only appears after "Observe →" is submitted. Before that, the editor is full-width — nothing competes with writing.
- Observation cards use a 3px left border in `--observer-accent` blue. This is the visual signature of the observer voice. Not an error annotation, a reading note.
- Classification buttons (Intentional / Accidental / Undecided) are small and subdued until selected. They're a question, not a command.
- "Observe →" is the only action button visible while writing. Minimal — not a form submit, more like turning a page.

**Mobile adaptation:** Stack the observation panel below the editor (full-width column layout). The editor gets full screen first; observations are a section below.

---

## App Icon

See `icon.png` (FLUX Pro final) and `icon-exploration.png` (earlier draft).

**Concept:** A circle containing a dark ink brushstroke in the upper half, with its faded mirror reflection in the lower half. A thin horizontal line at the midpoint is the mirror surface. The circle is the frame; the reflection is the concept.

**Palette:** Dark forest green / near-black ink (`#1a2e1e` approximately), faded gray-green reflection, warm cream background, silver-gray circle border.

**Notes for SVG implementation:**
- The icon works best as a hand-drawn or slightly irregular brushstroke (not a perfect geometric mark).
- The reflection should be visibly lighter — approximately 40% opacity of the original mark, flipped vertically.
- At 32px (favicon), the detail simplifies: the circle, the dark mark, and the faded reflection below the midline are the three readable elements.
- At 512px (app icon), the brushstroke texture should show.

---

## Mood References

Four reference images establish the atmosphere:

- `style-reference.png` — Hero image (FLUX Pro). Journal open on warm wood desk, afternoon window light, ink bottle, fountain pen, hand mirror. This is the scene ink-mirror lives in.
- `mood-journal-texture.png` — Close-up of handwritten journal, warm amber light. Tactile quality.
- `mood-evening-desk.png` — Writing desk at night, lamp, open journal. Contemplative atmosphere.
- `mood-ink-reflection.png` — Ink dropping into still surface with perfect vertical reflection. The conceptual anchor for the mirror metaphor.

---

## What This Visual Language Is Not

- Not a productivity app (Notion, Linear). No system colors, no badges, no progress indicators.
- Not a journaling/wellness app (DayOne, Reflectly). No illustrations, no gradient skies, no emojis.
- Not a writing tool (iA Writer). Close in spirit, but less austere — the warmth and the observer's slate blue are intentional differences.

ink-mirror is closer to a quality stationery brand than a software product. The interface should feel like it was made by someone who cares about the act of writing.

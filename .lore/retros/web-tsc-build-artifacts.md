---
title: "tsc --build ignores noEmit with composite, pollutes source tree"
date: 2026-03-27
status: complete
tags: [bug, typescript, build-config, next-js, tsc]
modules: [web]
related:
  - .lore/plans/dx-cleanup.md
---

# Retro: Web Package Build Artifacts and Dev Startup Failures

## Summary

`bun run dev` failed on the web package for two reasons: (1) Next.js tried to auto-install `@types/react` and `@types/node` via npm, which choked on bun's `workspace:*` protocol, and (2) every route and page had duplicate `.js`, `.d.ts`, and `.d.ts.map` files from a previous `tsc --build` run, causing "Duplicate page detected" warnings for every route.

## What Went Well

- Running the dev server and reading the actual logs surfaced both problems immediately. No guesswork.
- The duplicate page warning from Next.js was specific enough to identify the artifact files without digging.
- Direct `curl --unix-socket` from the previous retro's experience meant the daemon was quickly confirmed healthy, isolating the issue to the web package.

## What Could Improve

- The web package was missing standard devDependencies (`@types/react`, `@types/node`, `typescript`). These should have been included when the package was created. Next.js has an auto-install fallback that papers over this in some environments but breaks in workspace setups.
- The tsconfig.json had contradictory settings: `noEmit: true` alongside `composite: true`, `declaration: true`, and `declarationMap: true`. `tsc --build` ignores `noEmit` and uses `composite` + `declaration` to determine emit behavior. The result: typecheck emitted files into the source tree despite the intent to suppress output.
- No `.gitignore` in the web package and no patterns in the root `.gitignore` for stray build artifacts (`.d.ts`, `.d.ts.map`, `.js` alongside `.tsx` sources). The `dist/` pattern only catches the intended output directory.
- Nobody ran `bun run dev` after the typecheck setup was configured. A single dev startup would have caught both problems.

## Lessons Learned

- `tsc --build` ignores `noEmit`. When using TypeScript project references with `composite: true`, `tsc --build` always emits. The `noEmit` flag only applies to plain `tsc` (non-build mode). If a package is a leaf (nothing references it), it doesn't need `composite` at all.
- Next.js auto-installs missing type packages using npm, not bun. In a bun workspace, npm can't resolve `workspace:*` dependencies and fails. The fix is to declare type packages explicitly in devDependencies so the auto-installer never triggers.
- After configuring build tooling, run the actual dev workflow. `typecheck` passing is not the same as `dev` working. The two use different code paths (`tsc --build` vs Next.js Turbopack) and have different runtime requirements.

## Artifacts

- `packages/web/package.json` - added devDependencies for TypeScript types
- `packages/web/tsconfig.json` - removed `composite`, `declaration`, `declarationMap`
- Deleted 42 build artifacts (`.js`, `.d.ts`, `.d.ts.map`) from `packages/web/app/`

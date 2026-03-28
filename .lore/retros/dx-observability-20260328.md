---
title: Silent failures and missing observability across daemon, web, and DX tooling
date: 2026-03-28
status: complete
tags: [observability, logging, dx, silent-failure, sse, build-artifacts]
modules: [daemon, web, cli]
related: [.lore/retros/web-tsc-build-artifacts.md, .lore/plans/dx-cleanup.md]
---

# Retro: DX Observability Pass

## Summary

Fixed a cluster of issues discovered during first real use of ink-mirror: interleaved dev output, silent observer failures, stale build artifacts causing dev/prod divergence, daemon socket in /tmp, SSE connection lifecycle problems, and zero logging on the happy path.

## What Went Well

- The daemon architecture (DI, route factories, Hono test client) made every fix straightforward to test. No test infrastructure changes needed for any of these fixes.
- Each problem surfaced the next one naturally. Fixing interleaved output made the 502 visible, which led to the socket issue, which led to the SSE lifecycle, which led to the idle timeout, which led to the heartbeat.
- All 400+ tests continued passing through every change.

## What Could Improve

- The initial commit (DX cleanup PR #1) shipped with 12 stale .js/.d.ts files in the web components directory. These caused production to serve old component versions. The gitignore didn't prevent it and nobody caught it in review.
- The observer catch block silently swallowed errors, making it impossible to know the LLM call was failing. The daemon had one log line (startup) and nothing else. First real use was a black box.
- The SSE EventSource was opened on page mount and held indefinitely, not scoped to when it was needed (submission). This interacted badly with Bun's default 10-second idle timeout.
- The Unix socket defaulted to /tmp instead of the data directory, making it invisible alongside the data it serves.

## Lessons Learned

- Silent catch blocks in integration points (LLM calls, external services) are bugs, not defensive programming. If it can fail, log it and surface it.
- Happy-path logging is as important as error logging. When the daemon has no request logging, the first debugging step is always "add logging" instead of "diagnose the problem."
- SSE connections should be scoped to when they're needed. Opening on mount and holding forever wastes resources and creates idle timeout problems. Open on action, close on completion.
- Build artifacts in source directories (tsc emit alongside .tsx sources) will silently override the real source in production builds. Gitignore rules for emit patterns are a safety net, not optional cleanup.
- Bun.serve() has a 10-second default idle timeout. Any long-lived connection (SSE, WebSocket) needs either a heartbeat or an explicit timeout override. The heartbeat is better because it also keeps intermediary proxies alive.
- The default location for runtime artifacts (sockets, pid files) should be alongside the data they serve, not in /tmp. Makes the daemon's presence visible and keeps all state in one place.

## Artifacts

- `.lore/plans/dx-cleanup.md` - original DX cleanup plan
- `.lore/retros/web-tsc-build-artifacts.md` - earlier retro on the same build artifact issue

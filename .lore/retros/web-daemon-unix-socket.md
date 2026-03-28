---
title: "Bun fetch({ unix }) doesn't work in Next.js (runs on Node.js)"
date: 2026-03-27
status: complete
tags: [bug, runtime-mismatch, unix-socket, bun, node, next-js]
modules: [web, daemon]
related:
  - .lore/specs/v1-core-loop.md
---

# Retro: Web-to-Daemon Unix Socket Communication

## Summary

The web package's `daemon.ts` used Bun's `fetch({ unix })` extension to talk to the daemon over a Unix socket. Next.js runs on Node.js, not Bun, so that option was silently ignored. Every proxy request hit `http://localhost` on port 80, failed, and returned 502 "Daemon unavailable." Fixed by switching to Node's `http` module with `socketPath`.

## What Went Well

- The daemon was correctly serving on the Unix socket and responding fine. Direct `curl --unix-socket` confirmed this immediately, narrowing the problem to the proxy layer.
- The catch block in the Next.js route handlers produced a clear 502 with "Daemon unavailable," which pointed directly at the proxy, not the daemon.
- The fix was clean: `node:http` with `socketPath` is the standard Node.js approach. Added a streaming variant (`daemonFetchStream`) for SSE proxying at the same time.

## What Could Improve

- This should have been caught when the web package was first written. The `daemon.ts` file was authored assuming Bun runtime, but `next dev` runs Node.js. The assumption was never tested.
- The error was silent. Node's `fetch` doesn't throw on unrecognized options; it just ignores `unix`. A more defensive approach would have been to verify the socket connection on startup.

## Lessons Learned

- When `bun run` launches a subprocess (like `next dev`), the subprocess runs on its own runtime, not Bun. Next.js uses Node.js. Bun-specific APIs (`fetch({ unix })`, `Bun.serve()`, etc.) are not available in Next.js server-side code.
- Node's `fetch` silently ignores unknown options. There's no error when you pass `{ unix: "/tmp/foo.sock" }` to Node's fetch; it just connects to localhost. This makes runtime mismatches hard to spot.
- SSE proxy routes need streaming responses. When switching from `fetch` to `http.request`, the buffered and streaming paths need different handling. Splitting into `daemonFetch` (buffered) and `daemonFetchStream` was the right call.

## Artifacts

- `packages/web/lib/daemon.ts` - rewritten from Bun fetch to Node http module
- `packages/web/app/api/events/observations/route.ts` - updated to use `daemonFetchStream`

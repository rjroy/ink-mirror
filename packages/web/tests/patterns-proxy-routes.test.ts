import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Exercises the Next.js API routes under app/api/patterns/** that proxy to
 * the daemon over a Unix socket (lib/daemon.ts's daemonFetch). These are
 * thin pass-throughs: a `daemonFetch` call wrapped in try/catch that returns
 * 502 on failure. The original suite covered `session`, `[id]`, and
 * `[id]/classify` to establish the pattern; the Phase 7 audit found the
 * other ten routes (`route` (list), `watch`, and eight `[id]/<action>`
 * mutation routes) had zero test coverage — never imported by any test, not
 * merely under-tested. This suite adds one describe block per remaining
 * route, following the same convention: static imports (so TS can type the
 * handler instead of falling back to `any` from a dynamic import path,
 * which the eight structurally-identical mutation routes would otherwise
 * tempt into a loop), method/path/body forwarding, and a non-2xx
 * passthrough check.
 *
 * No prior test in this project actually invoked a proxy route handler
 * against a live daemon connection (nudge-route.test.ts only checks that
 * POST is exported; daemon-client.test.ts only checks daemonFetch's shape).
 * Rather than mock.module() (forbidden project-wide) or patch global fetch
 * (daemonFetch uses node:http's socketPath, not fetch), this suite stands up
 * a real fake daemon on a temp Unix socket and points lib/daemon.ts at it via
 * INK_MIRROR_SOCKET. lib/daemon.ts resolves that env var per-request (not
 * once at module load), so this works regardless of import order relative
 * to other test files in the same bun test process.
 */

interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
}

let dataDir: string;
let socketPath: string;
let fakeDaemon: ReturnType<typeof Bun.serve>;
let received: RecordedRequest[];
let nextResponse: { status: number; body: unknown };

beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), "ink-mirror-proxy-test-"));
  socketPath = join(dataDir, "fake-daemon.sock");
  process.env.INK_MIRROR_SOCKET = socketPath;

  fakeDaemon = Bun.serve({
    unix: socketPath,
    async fetch(req) {
      const url = new URL(req.url);
      const body = req.method === "GET" ? undefined : await req.json().catch(() => undefined);
      // Concatenating pathname+search (rather than just pathname) lets the
      // list route's test below assert the `?status=` query string was
      // forwarded, without changing anything for the other routes here,
      // none of which use a query string (their url.search is always "").
      received.push({ method: req.method, path: url.pathname + url.search, body });
      return new Response(JSON.stringify(nextResponse.body), {
        status: nextResponse.status,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
});

afterAll(() => {
  void fakeDaemon.stop(true);
  delete process.env.INK_MIRROR_SOCKET;
  rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  received = [];
  nextResponse = { status: 200, body: {} };
});

describe("GET /api/patterns/session", () => {
  test("forwards the daemon's session payload verbatim", async () => {
    const sessionFixture = {
      dossiers: [],
      contradictions: [],
      watchList: [],
      resurfacedRules: [],
      proposals: [],
    };
    nextResponse = { status: 200, body: sessionFixture };

    const { GET } = await import("../app/api/patterns/session/route");
    const res = await GET();

    expect(received).toEqual([{ method: "GET", path: "/patterns/session", body: undefined }]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(sessionFixture);
  });
});

describe("GET /api/patterns/[id]", () => {
  test("forwards the requested id to the daemon and returns its dossier", async () => {
    const dossierFixture = {
      sightings: [],
      distinctEntryCount: 0,
      pattern: { id: "pat-1", statement: "Test", dimension: "sentence-rhythm", status: "candidate" },
      isProposal: false,
    };
    nextResponse = { status: 200, body: dossierFixture };

    const { GET } = await import("../app/api/patterns/[id]/route");
    const res = await GET(new Request("http://localhost/api/patterns/pat-1"), {
      params: Promise.resolve({ id: "pat-1" }),
    });

    expect(received).toEqual([{ method: "GET", path: "/patterns/pat-1", body: undefined }]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(dossierFixture);
  });
});

describe("POST /api/patterns/[id]/classify", () => {
  test("forwards the request body and the id in the path to the daemon", async () => {
    nextResponse = { status: 200, body: { id: "pat-1", status: "intentional" } };

    const { POST } = await import("../app/api/patterns/[id]/classify/route");
    const request = new Request("http://localhost/api/patterns/pat-1/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "intentional", promote: true }),
    });
    const res = await POST(request, { params: Promise.resolve({ id: "pat-1" }) });

    expect(received).toEqual([
      { method: "POST", path: "/patterns/pat-1/classify", body: { status: "intentional", promote: true } },
    ]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "pat-1", status: "intentional" });
  });
});

describe("GET /api/patterns (list)", () => {
  test("forwards to /patterns with no status filter", async () => {
    const fixture = [{ id: "pat-1", statement: "Test", dimension: "sentence-rhythm", status: "candidate" }];
    nextResponse = { status: 200, body: fixture };

    const { GET } = await import("../app/api/patterns/route");
    const res = await GET(new Request("http://localhost/api/patterns"));

    expect(received).toEqual([{ method: "GET", path: "/patterns", body: undefined }]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(fixture);
  });

  test("forwards the status query param to the daemon", async () => {
    nextResponse = { status: 200, body: [] };

    const { GET } = await import("../app/api/patterns/route");
    const res = await GET(new Request("http://localhost/api/patterns?status=candidate"));

    expect(received).toEqual([{ method: "GET", path: "/patterns?status=candidate", body: undefined }]);
    expect(res.status).toBe(200);
  });

  test("forwards a non-2xx daemon response as-is", async () => {
    nextResponse = { status: 500, body: { error: "boom" } };

    const { GET } = await import("../app/api/patterns/route");
    const res = await GET(new Request("http://localhost/api/patterns"));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "boom" });
  });
});

describe("GET /api/patterns/watch", () => {
  test("forwards to /patterns/watch and returns the watch list", async () => {
    const fixture = { watchList: [] };
    nextResponse = { status: 200, body: fixture };

    const { GET } = await import("../app/api/patterns/watch/route");
    const res = await GET();

    expect(received).toEqual([{ method: "GET", path: "/patterns/watch", body: undefined }]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(fixture);
  });

  test("forwards a non-2xx daemon response as-is", async () => {
    nextResponse = { status: 503, body: { error: "unavailable" } };

    const { GET } = await import("../app/api/patterns/watch/route");
    const res = await GET();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
  });
});

describe("POST /api/patterns/[id]/detach", () => {
  test("forwards the sightingId body and the id in the path to the daemon", async () => {
    nextResponse = { status: 200, body: { source: { id: "pat-1" }, newPattern: { id: "pat-2" } } };

    const { POST } = await import("../app/api/patterns/[id]/detach/route");
    const request = new Request("http://localhost/api/patterns/pat-1/detach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sightingId: "sight-1" }),
    });
    const res = await POST(request, { params: Promise.resolve({ id: "pat-1" }) });

    expect(received).toEqual([
      { method: "POST", path: "/patterns/pat-1/detach", body: { sightingId: "sight-1" } },
    ]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ source: { id: "pat-1" }, newPattern: { id: "pat-2" } });
  });

  test("forwards a non-2xx daemon response as-is", async () => {
    nextResponse = { status: 404, body: { error: "sighting not found" } };

    const { POST } = await import("../app/api/patterns/[id]/detach/route");
    const request = new Request("http://localhost/api/patterns/pat-1/detach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sightingId: "sight-1" }),
    });
    const res = await POST(request, { params: Promise.resolve({ id: "pat-1" }) });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "sighting not found" });
  });
});

describe("POST /api/patterns/[id]/dismiss", () => {
  test("forwards the request and the id in the path to the daemon", async () => {
    nextResponse = { status: 200, body: { id: "pat-1", status: "dismissed" } };

    const { POST } = await import("../app/api/patterns/[id]/dismiss/route");
    const request = new Request("http://localhost/api/patterns/pat-1/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(request, { params: Promise.resolve({ id: "pat-1" }) });

    expect(received).toEqual([{ method: "POST", path: "/patterns/pat-1/dismiss", body: {} }]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "pat-1", status: "dismissed" });
  });

  test("forwards a non-2xx daemon response as-is", async () => {
    nextResponse = { status: 409, body: { error: "cannot dismiss" } };

    const { POST } = await import("../app/api/patterns/[id]/dismiss/route");
    const request = new Request("http://localhost/api/patterns/pat-1/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(request, { params: Promise.resolve({ id: "pat-1" }) });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "cannot dismiss" });
  });
});

describe("POST /api/patterns/[id]/merge", () => {
  test("forwards the duplicateId body and the id in the path to the daemon", async () => {
    nextResponse = { status: 200, body: { id: "pat-1" } };

    const { POST } = await import("../app/api/patterns/[id]/merge/route");
    const request = new Request("http://localhost/api/patterns/pat-1/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duplicateId: "pat-2" }),
    });
    const res = await POST(request, { params: Promise.resolve({ id: "pat-1" }) });

    expect(received).toEqual([
      { method: "POST", path: "/patterns/pat-1/merge", body: { duplicateId: "pat-2" } },
    ]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "pat-1" });
  });

  test("forwards a non-2xx daemon response as-is", async () => {
    nextResponse = { status: 400, body: { error: "dimension mismatch" } };

    const { POST } = await import("../app/api/patterns/[id]/merge/route");
    const request = new Request("http://localhost/api/patterns/pat-1/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duplicateId: "pat-2" }),
    });
    const res = await POST(request, { params: Promise.resolve({ id: "pat-1" }) });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "dimension mismatch" });
  });
});

describe("POST /api/patterns/[id]/promote", () => {
  test("forwards the request and the id in the path to the daemon", async () => {
    nextResponse = { status: 200, body: { id: "pat-1", rule: { id: "rule-1" } } };

    const { POST } = await import("../app/api/patterns/[id]/promote/route");
    const request = new Request("http://localhost/api/patterns/pat-1/promote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(request, { params: Promise.resolve({ id: "pat-1" }) });

    expect(received).toEqual([{ method: "POST", path: "/patterns/pat-1/promote", body: {} }]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "pat-1", rule: { id: "rule-1" } });
  });

  test("forwards a non-2xx daemon response as-is", async () => {
    nextResponse = { status: 409, body: { error: "already promoted" } };

    const { POST } = await import("../app/api/patterns/[id]/promote/route");
    const request = new Request("http://localhost/api/patterns/pat-1/promote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(request, { params: Promise.resolve({ id: "pat-1" }) });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "already promoted" });
  });
});

describe("POST /api/patterns/[id]/proposal", () => {
  test("forwards the action body and the id in the path to the daemon", async () => {
    nextResponse = { status: 200, body: { id: "pat-1", status: "intentional", ruleId: "rule-1" } };

    const { POST } = await import("../app/api/patterns/[id]/proposal/route");
    const request = new Request("http://localhost/api/patterns/pat-1/proposal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    const res = await POST(request, { params: Promise.resolve({ id: "pat-1" }) });

    expect(received).toEqual([
      { method: "POST", path: "/patterns/pat-1/proposal", body: { action: "accept" } },
    ]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "pat-1", status: "intentional", ruleId: "rule-1" });
  });

  test("forwards a non-2xx daemon response as-is", async () => {
    nextResponse = { status: 404, body: { error: "no proposal pending" } };

    const { POST } = await import("../app/api/patterns/[id]/proposal/route");
    const request = new Request("http://localhost/api/patterns/pat-1/proposal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline" }),
    });
    const res = await POST(request, { params: Promise.resolve({ id: "pat-1" }) });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "no proposal pending" });
  });
});

describe("POST /api/patterns/[id]/reactivate", () => {
  test("forwards the request and the id in the path to the daemon", async () => {
    nextResponse = { status: 200, body: { id: "pat-1", status: "candidate" } };

    const { POST } = await import("../app/api/patterns/[id]/reactivate/route");
    const request = new Request("http://localhost/api/patterns/pat-1/reactivate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(request, { params: Promise.resolve({ id: "pat-1" }) });

    expect(received).toEqual([{ method: "POST", path: "/patterns/pat-1/reactivate", body: {} }]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "pat-1", status: "candidate" });
  });

  test("forwards a non-2xx daemon response as-is", async () => {
    nextResponse = { status: 409, body: { error: "not retired" } };

    const { POST } = await import("../app/api/patterns/[id]/reactivate/route");
    const request = new Request("http://localhost/api/patterns/pat-1/reactivate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(request, { params: Promise.resolve({ id: "pat-1" }) });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "not retired" });
  });
});

describe("POST /api/patterns/[id]/reaffirm", () => {
  test("forwards the request and the id in the path to the daemon", async () => {
    nextResponse = { status: 200, body: { id: "rule-1", pattern: "Test" } };

    const { POST } = await import("../app/api/patterns/[id]/reaffirm/route");
    const request = new Request("http://localhost/api/patterns/pat-1/reaffirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(request, { params: Promise.resolve({ id: "pat-1" }) });

    expect(received).toEqual([{ method: "POST", path: "/patterns/pat-1/reaffirm", body: {} }]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "rule-1", pattern: "Test" });
  });

  test("forwards a non-2xx daemon response as-is", async () => {
    nextResponse = { status: 404, body: { error: "no linked rule" } };

    const { POST } = await import("../app/api/patterns/[id]/reaffirm/route");
    const request = new Request("http://localhost/api/patterns/pat-1/reaffirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(request, { params: Promise.resolve({ id: "pat-1" }) });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "no linked rule" });
  });
});

describe("POST /api/patterns/[id]/retire", () => {
  test("forwards the request and the id in the path to the daemon", async () => {
    nextResponse = { status: 200, body: { id: "pat-1", status: "retired" } };

    const { POST } = await import("../app/api/patterns/[id]/retire/route");
    const request = new Request("http://localhost/api/patterns/pat-1/retire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(request, { params: Promise.resolve({ id: "pat-1" }) });

    expect(received).toEqual([{ method: "POST", path: "/patterns/pat-1/retire", body: {} }]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "pat-1", status: "retired" });
  });

  test("forwards a non-2xx daemon response as-is", async () => {
    nextResponse = { status: 409, body: { error: "already retired" } };

    const { POST } = await import("../app/api/patterns/[id]/retire/route");
    const request = new Request("http://localhost/api/patterns/pat-1/retire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(request, { params: Promise.resolve({ id: "pat-1" }) });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "already retired" });
  });
});

describe("error propagation", () => {
  test("a non-2xx daemon response is forwarded as-is, not swallowed into a generic error", async () => {
    nextResponse = { status: 409, body: { error: "invalid transition" } };

    const { POST } = await import("../app/api/patterns/[id]/classify/route");
    const request = new Request("http://localhost/api/patterns/pat-1/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "accidental" }),
    });
    const res = await POST(request, { params: Promise.resolve({ id: "pat-1" }) });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "invalid transition" });
  });
});

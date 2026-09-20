import { NextResponse } from "next/server";
import { daemonFetch } from "@/lib/daemon";

// The `?status=` filter this proxy used to forward is gone (REQ-LPC-30):
// classification moved to pattern grain, and the daemon's GET /observations
// no longer has a per-observation status to filter by.
export async function GET() {
  try {
    const res = await daemonFetch("/observations");
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error(`[api] GET /api/observations failed:`, err);
    return NextResponse.json({ error: "Daemon unavailable" }, { status: 502 });
  }
}

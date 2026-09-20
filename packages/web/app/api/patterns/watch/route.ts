import { NextResponse } from "next/server";
import { daemonFetch } from "@/lib/daemon";

export async function GET() {
  try {
    const res = await daemonFetch("/patterns/watch");
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error(`[api] GET /api/patterns/watch failed:`, err);
    return NextResponse.json({ error: "Daemon unavailable" }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { daemonFetch } from "@/lib/daemon";

export async function GET() {
  try {
    const res = await daemonFetch("/entries");
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Daemon unavailable" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const res = await daemonFetch("/entries", { method: "POST", body });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Daemon unavailable" }, { status: 502 });
  }
}

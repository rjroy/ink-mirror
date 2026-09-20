import { NextResponse } from "next/server";
import { daemonFetch } from "@/lib/daemon";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const res = await daemonFetch(`/patterns/${id}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error(`[api] GET /api/patterns/:id failed:`, err);
    return NextResponse.json({ error: "Daemon unavailable" }, { status: 502 });
  }
}

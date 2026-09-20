import { NextResponse } from "next/server";
import { daemonFetch } from "@/lib/daemon";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const res = await daemonFetch(`/entries/${encodeURIComponent(id)}/reflect`, {
      method: "POST",
      body: {},
    });
    const data: unknown = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error(`[api] POST /api/entries/${id}/reflect failed:`, err);
    return NextResponse.json({ error: "Daemon unavailable" }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { daemonFetch } from "@/lib/daemon";

export async function GET() {
  const res = await daemonFetch("/observations/pending");
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

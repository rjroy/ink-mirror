import { NextResponse } from "next/server";
import { daemonFetch } from "@/lib/daemon";

export async function GET() {
  const res = await daemonFetch("/profile");
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function PUT(request: Request) {
  const body: unknown = await request.json();
  const res = await daemonFetch("/profile", { method: "PUT", body });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

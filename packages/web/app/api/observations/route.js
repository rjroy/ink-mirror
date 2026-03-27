import { NextResponse } from "next/server";
import { daemonFetch } from "@/lib/daemon";
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const path = status ? `/observations?status=${status}` : "/observations";
    const res = await daemonFetch(path);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
}

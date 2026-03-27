import { NextResponse } from "next/server";
import { daemonFetch } from "@/lib/daemon";
export async function GET() {
    const res = await daemonFetch("/entries");
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
}
export async function POST(request) {
    const body = await request.json();
    const res = await daemonFetch("/entries", { method: "POST", body });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
}

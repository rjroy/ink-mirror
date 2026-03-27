import { NextResponse } from "next/server";
import { daemonFetch } from "@/lib/daemon";
export async function PATCH(request, { params }) {
    const { id } = await params;
    const body = await request.json();
    const res = await daemonFetch(`/observations/${id}`, { method: "PATCH", body });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
}

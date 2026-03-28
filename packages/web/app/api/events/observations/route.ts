import { daemonFetchStream } from "@/lib/daemon";

/**
 * SSE proxy: subscribes to daemon observation events and streams them to the browser.
 * The daemon SSE endpoint uses the EventBus internally.
 */
export async function GET() {
  try {
    const daemonResponse = await daemonFetchStream("/events/observations");

    if (!daemonResponse.body) {
      return new Response("No stream available", { status: 502 });
    }

    return new Response(daemonResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return new Response("Daemon unavailable", { status: 502 });
  }
}

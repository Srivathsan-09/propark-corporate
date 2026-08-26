import { NextRequest } from "next/server";
import { realtimeEventBus, IRealtimeEvent } from "@/lib/concurrency/RealtimeEventBus";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "CONNECTED", timestamp: new Date() })}\n\n`)
      );

      const unsubscribe = realtimeEventBus.subscribeSSE((event: IRealtimeEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch (e) {
          // Stream closed
        }
      });

      // Keepalive heartbeat every 15 seconds
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch (e) {
          clearInterval(heartbeatInterval);
        }
      }, 15000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

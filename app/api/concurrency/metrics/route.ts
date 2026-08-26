import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { loadBalancer } from "@/lib/concurrency/LoadBalancer";
import { rideBookingQueue } from "@/lib/concurrency/RideBookingQueue";
import { workerPool } from "@/lib/concurrency/WorkerPool";
import { realtimeEventBus } from "@/lib/concurrency/RealtimeEventBus";
import { IConcurrencyMetrics } from "@/lib/concurrency/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user?.role !== "admin" && session.user?.role !== "campus_admin")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 401 }
      );
    }

    const lbMetrics = loadBalancer.getMetrics();
    const queueMetrics = rideBookingQueue.getQueueMetrics();
    const workerMetrics = workerPool.getWorkerMetrics();

    const metrics: IConcurrencyMetrics = {
      loadBalancer: {
        strategy: "ROUND_ROBIN",
        activeNodeCount: lbMetrics.activeNodeCount,
        totalNodes: lbMetrics.totalNodes,
        totalRequestsRouted: lbMetrics.totalRequestsRouted,
        currentNodeIndex: lbMetrics.currentNodeIndex,
      },
      serverNodes: lbMetrics.nodes,
      queues: queueMetrics,
      workers: workerMetrics,
      performance: {
        avgResponseTimeMs: workerMetrics.avgResponseTimeMs,
        peakResponseTimeMs: workerMetrics.peakResponseTimeMs,
        lastUpdated: new Date(),
      },
    };

    return NextResponse.json({
      success: true,
      metrics,
      activeSseClients: realtimeEventBus.getClientCount(),
    });
  } catch (error: any) {
    console.error("Concurrency Metrics API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch concurrency metrics." },
      { status: 500 }
    );
  }
}

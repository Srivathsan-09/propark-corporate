import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { loadTestRunner } from "@/lib/concurrency/LoadTestRunner";
import { loadBalancer } from "@/lib/concurrency/LoadBalancer";
import { resetMongoConnection } from "@/lib/db/mongodb";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user?.role !== "admin" && session.user?.role !== "campus_admin")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const testId = body.testId || "test1";
    const action = body.action;

    // Support server node simulation toggling (e.g. mark Server 1 offline)
    if (action === "toggle-node") {
      const { nodeId, status } = body;
      loadBalancer.setNodeStatus(nodeId, status);
      return NextResponse.json({
        success: true,
        message: `Node ${nodeId} status updated to ${status}`,
        loadBalancerMetrics: loadBalancer.getMetrics(),
      });
    }

    let config = {
      testId,
      totalSeats: 50,
      concurrentUsers: 10,
      useLoadBalancer: true,
      testIdempotency: false,
    };

    switch (testId) {
      case "test1":
        config = { testId: "test1", totalSeats: 50, concurrentUsers: 10, useLoadBalancer: true, testIdempotency: false };
        break;
      case "test2":
        config = { testId: "test2", totalSeats: 50, concurrentUsers: 100, useLoadBalancer: true, testIdempotency: false };
        break;
      case "test3":
        config = { testId: "test3", totalSeats: 1, concurrentUsers: 100, useLoadBalancer: true, testIdempotency: false };
        break;
      case "test4":
        config = { testId: "test4", totalSeats: 0, concurrentUsers: 100, useLoadBalancer: true, testIdempotency: false };
        break;
      case "test5":
        config = { testId: "test5", totalSeats: 1, concurrentUsers: 100, useLoadBalancer: true, testIdempotency: false };
        break;
      case "test6":
        config = { testId: "test6", totalSeats: 1, concurrentUsers: 10, useLoadBalancer: true, testIdempotency: true };
        break;
    }

    let result;
    try {
      result = await loadTestRunner.runTest(config as any);
    } catch (err: any) {
      const errMsg = String(err?.message || "");
      if (errMsg.includes("SSL") || errMsg.includes("tlsv1") || errMsg.includes("cleared")) {
        console.warn("SSL connection reset detected. Re-establishing MongoDB connection and retrying test...");
        await resetMongoConnection();
        result = await loadTestRunner.runTest(config as any);
      } else {
        throw err;
      }
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error("Load Test API Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to execute load test." },
      { status: 500 }
    );
  }
}

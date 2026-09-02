"use client";

import React, { useState, useEffect } from "react";
import {
  Server,
  Cpu,
  Layers,
  Zap,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Activity,
  ShieldCheck,
  Building2,
  Users,
  Database,
  ArrowRight,
  Sparkles,
  Terminal,
  Lock,
  Radio,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CarLoader } from "@/components/common/CarLoader";
import { IConcurrencyMetrics, ILoadTestResult, IServerNode } from "@/lib/concurrency/types";

export default function AdminConcurrencyPage() {
  const [metrics, setMetrics] = useState<IConcurrencyMetrics | null>(null);
  const [activeSseCount, setActiveSseCount] = useState<number>(0);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ILoadTestResult | null>(null);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);

  // Fetch initial metrics
  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/concurrency/metrics");
      const data = await res.json();
      if (data.success && data.metrics) {
        setMetrics(data.metrics);
        setActiveSseCount(data.activeSseClients || 0);
      }
    } catch (err) {
      console.error("Failed to fetch concurrency metrics:", err);
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);

    // Subscribe to Realtime SSE Stream
    const eventSource = new EventSource("/api/rides/realtime/stream");
    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "RIDE_AVAILABILITY_UPDATED" || parsed.type === "QUEUE_POSITION_UPDATED") {
          fetchMetrics();
        }
      } catch (e) {}
    };

    return () => {
      clearInterval(interval);
      eventSource.close();
    };
  }, []);

  // Run selected Load Test
  const handleRunLoadTest = async (testId: string) => {
    setIsRunningTest(true);
    setActiveTestId(testId);
    setTestResult(null);
    setExecutionLogs([`[${new Date().toLocaleTimeString()}] Dispatching Load Test: ${testId.toUpperCase()}...`]);

    try {
      const res = await fetch("/api/concurrency/load-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId }),
      });
      const data = await res.json();

      if (data.success && data.result) {
        setTestResult(data.result);
        setExecutionLogs(data.result.log || []);
        fetchMetrics();
      } else {
        setExecutionLogs((prev) => [...prev, `❌ Error: ${data.error || "Load test failed"}`]);
      }
    } catch (err: any) {
      setExecutionLogs((prev) => [...prev, `❌ Error: ${err?.message || "Network error"}`]);
    } finally {
      setIsRunningTest(false);
      setActiveTestId(null);
    }
  };

  // Toggle server node online/offline status
  const handleToggleNodeStatus = async (nodeId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "ONLINE" ? "OFFLINE" : "ONLINE";
    try {
      const res = await fetch("/api/concurrency/load-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-node", nodeId, status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchMetrics();
      }
    } catch (e) {}
  };

  if (isLoadingMetrics && !metrics) {
    return (
      <div className="flex h-[75vh] w-full items-center justify-center p-6">
        <CarLoader size="lg" message="Connecting to High-Concurrency Engine & Load Balancer..." />
      </div>
    );
  }

  const nodes = metrics?.serverNodes || [];
  const lb = metrics?.loadBalancer;
  const queues = metrics?.queues;
  const workers = metrics?.workers;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in-50 duration-300">
      {/* Top Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-900 text-emerald-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                CommuteX Concurrency & Load Balancing
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-server Round-Robin Load Balancer • Ride-Scoped FIFO Queues • Atomic MongoDB Transactions
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-600 text-white font-bold text-xs px-3 py-1.5 gap-1.5">
            <Radio className="h-3.5 w-3.5 animate-ping" /> Real-time SSE Connected ({activeSseCount})
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMetrics}
            className="rounded-xl text-xs font-semibold gap-1.5 border-slate-300"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh Metrics
          </Button>
        </div>
      </div>



      {/* 2. Backend Server Nodes Control Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {nodes.map((node: IServerNode) => {
          const isOnline = node.status === "ONLINE";
          return (
            <Card
              key={node.id}
              className={`border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden ${
                !isOnline ? "opacity-75 bg-slate-50 border-rose-200" : ""
              }`}
            >
              <CardHeader className="p-4 bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-2 rounded-xl text-white font-bold text-xs ${
                      isOnline ? "bg-slate-900" : "bg-rose-600"
                    }`}
                  >
                    <Server className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900">
                      {node.id}
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-500">
                      Port: {node.port} • Stateless Node
                    </CardDescription>
                  </div>
                </div>

                <Badge
                  className={`text-[10px] font-bold ${
                    isOnline ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                  }`}
                >
                  {node.status}
                </Badge>
              </CardHeader>

              <CardContent className="p-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Active Requests</span>
                    <strong className="text-sm text-slate-900 font-extrabold">{node.activeRequests}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">Total Routed</span>
                    <strong className="text-sm text-emerald-700 font-extrabold">{node.totalRouted}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Heartbeat: {new Date(node.lastHeartbeat).toLocaleTimeString()}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleNodeStatus(node.id, node.status)}
                    className="text-purple-700 hover:text-purple-900 font-bold hover:underline"
                  >
                    {isOnline ? "Simulate Server Failure" : "Restore Server Node"}
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 3. Interactive Load Test Suite Console */}
      <Card className="border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50/80 border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                High-Concurrency Load Testing Suite
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Dispatches simultaneous concurrent employee booking requests against atomic MongoDB transactions
              </CardDescription>
            </div>
            {isRunningTest && (
              <Badge className="bg-purple-600 text-white font-bold text-xs gap-1.5 animate-pulse">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Test {activeTestId?.toUpperCase()} Running...
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-6">
          {/* Test Trigger Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Test 1 */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">Test 1: 50 Seats / 10 Users</span>
                <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50">Light Load</Badge>
              </div>
              <p className="text-[11px] text-slate-500">10 concurrent requests for 50 available seats.</p>
              <Button
                size="sm"
                disabled={isRunningTest}
                onClick={() => handleRunLoadTest("test1")}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-8 rounded-lg gap-1.5"
              >
                <Play className="h-3 w-3 fill-current" /> Run Test 1
              </Button>
            </div>

            {/* Test 2 */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">Test 2: 50 Seats / 100 Users</span>
                <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50">Medium Load</Badge>
              </div>
              <p className="text-[11px] text-slate-500">100 concurrent requests competing for 50 seats.</p>
              <Button
                size="sm"
                disabled={isRunningTest}
                onClick={() => handleRunLoadTest("test2")}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-8 rounded-lg gap-1.5"
              >
                <Play className="h-3 w-3 fill-current" /> Run Test 2
              </Button>
            </div>

            {/* Test 3 CRITICAL */}
            <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/40 hover:bg-purple-50/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-purple-950">Test 3: 1 Seat / 100 Users</span>
                <Badge className="text-[10px] bg-purple-600 text-white font-bold">Critical Test</Badge>
              </div>
              <p className="text-[11px] text-purple-900">100 simultaneous users competing for 1 final seat.</p>
              <Button
                size="sm"
                disabled={isRunningTest}
                onClick={() => handleRunLoadTest("test3")}
                className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs h-8 rounded-lg gap-1.5 shadow-xs"
              >
                <Play className="h-3 w-3 fill-current" /> Run Test 3
              </Button>
            </div>

            {/* Test 4 */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">Test 4: 0 Seats / 100 Users</span>
                <Badge variant="outline" className="text-[10px] text-rose-700 bg-rose-50">Overbooked</Badge>
              </div>
              <p className="text-[11px] text-slate-500">100 concurrent requests when ride has 0 seats.</p>
              <Button
                size="sm"
                disabled={isRunningTest}
                onClick={() => handleRunLoadTest("test4")}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-8 rounded-lg gap-1.5"
              >
                <Play className="h-3 w-3 fill-current" /> Run Test 4
              </Button>
            </div>

            {/* Test 5 MULTI-SERVER */}
            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-emerald-950">Test 5: 3 Servers / 100 Users</span>
                <Badge className="text-[10px] bg-emerald-600 text-white font-bold">Multi-Node LB</Badge>
              </div>
              <p className="text-[11px] text-emerald-900">100 users routed across Server 1, 2, 3 via Round Robin.</p>
              <Button
                size="sm"
                disabled={isRunningTest}
                onClick={() => handleRunLoadTest("test5")}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-8 rounded-lg gap-1.5 shadow-xs"
              >
                <Play className="h-3 w-3 fill-current" /> Run Test 5
              </Button>
            </div>

            {/* Test 6 IDEMPOTENCY */}
            <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-blue-950">Test 6: Idempotency Retry</span>
                <Badge className="text-[10px] bg-blue-600 text-white font-bold">Idempotency</Badge>
              </div>
              <p className="text-[11px] text-blue-900">1 user sending 10 identical requests with same key.</p>
              <Button
                size="sm"
                disabled={isRunningTest}
                onClick={() => handleRunLoadTest("test6")}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs h-8 rounded-lg gap-1.5 shadow-xs"
              >
                <Play className="h-3 w-3 fill-current" /> Run Test 6
              </Button>
            </div>
          </div>

          {/* Test Results Display Box */}
          {testResult && (
            <div className="space-y-4 pt-2 animate-in fade-in-50">
              <div className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-md">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Load Test Execution Result</span>
                  <strong className="text-base font-bold text-emerald-400">{testResult.testName}</strong>
                </div>

                <div className="flex items-center gap-2">
                  {testResult.isConcurrencySafe ? (
                    <Badge className="bg-emerald-600 text-white text-xs font-bold px-3 py-1 gap-1">
                      <ShieldCheck className="h-4 w-4" /> PASS ✓
                    </Badge>
                  ) : (
                    <Badge className="bg-rose-600 text-white text-xs font-bold px-3 py-1 gap-1">
                      <XCircle className="h-4 w-4" /> FAIL ✗
                    </Badge>
                  )}
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <span className="text-[10px] text-emerald-800 font-bold uppercase block">New Bookings</span>
                  <strong className="text-lg font-extrabold text-emerald-700">{testResult.successfulBookings}</strong>
                </div>

                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center">
                  <span className="text-[10px] text-indigo-800 font-bold uppercase block">Idempotent Replays</span>
                  <strong className="text-lg font-extrabold text-indigo-700">{testResult.idempotentHits || 0}</strong>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Failed / Queued</span>
                  <strong className="text-lg font-extrabold text-slate-700">{testResult.failedBookings}</strong>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
                  <span className="text-[10px] text-blue-800 font-bold uppercase block">Remaining Seats in DB</span>
                  <strong className="text-lg font-extrabold text-blue-700">{testResult.remainingSeats}</strong>
                </div>

                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-center">
                  <span className="text-[10px] text-purple-800 font-bold uppercase block">Duplicate Bookings</span>
                  <strong className="text-lg font-extrabold text-purple-700">{testResult.duplicateBookings}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Real-time Execution Terminal Logs */}
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-2 text-xs font-mono text-slate-300">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-emerald-400" /> Real-time Execution Logs
              </span>
              <span className="text-[10px] text-slate-500">{executionLogs.length} events logged</span>
            </div>

            <div className="h-44 overflow-y-auto space-y-1 text-[11px] scrollbar-thin">
              {executionLogs.length === 0 ? (
                <span className="text-slate-600">Select any load test above to execute live concurrent booking simulations.</span>
              ) : (
                executionLogs.map((logLine, idx) => (
                  <div
                    key={idx}
                    className={
                      logLine.includes("✅")
                        ? "text-emerald-400 font-bold"
                        : logLine.includes("🚀") || logLine.includes("🏁")
                        ? "text-purple-300 font-bold"
                        : logLine.includes("❌")
                        ? "text-rose-400 font-bold"
                        : "text-slate-300"
                    }
                  >
                    {logLine}
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

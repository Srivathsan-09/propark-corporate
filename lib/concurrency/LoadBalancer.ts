/**
 * CommuteX Round-Robin Load Balancer Service
 * Distributes incoming ride-booking traffic across multiple backend server instances (Server 1, Server 2, Server 3)
 */

import { IServerNode } from "./types";

class LoadBalancerService {
  private nodes: IServerNode[] = [
    {
      id: "Server 1",
      port: 3001,
      status: "ONLINE",
      activeRequests: 0,
      totalRouted: 0,
      lastHeartbeat: new Date(),
    },
    {
      id: "Server 2",
      port: 3002,
      status: "ONLINE",
      activeRequests: 0,
      totalRouted: 0,
      lastHeartbeat: new Date(),
    },
    {
      id: "Server 3",
      port: 3003,
      status: "ONLINE",
      activeRequests: 0,
      totalRouted: 0,
      lastHeartbeat: new Date(),
    },
  ];

  private currentIndex: number = 0;
  private totalRequestsRouted: number = 0;

  /**
   * Selects the next backend server node using Round Robin strategy
   */
  public getNextNode(): IServerNode {
    const onlineNodes = this.nodes.filter((n) => n.status === "ONLINE");

    if (onlineNodes.length === 0) {
      // Fallback to first node if all marked offline in dev
      return this.nodes[0];
    }

    // Round Robin selection
    const selectedNode = onlineNodes[this.currentIndex % onlineNodes.length];
    this.currentIndex = (this.currentIndex + 1) % onlineNodes.length;

    // Update stats
    selectedNode.totalRouted += 1;
    selectedNode.activeRequests += 1;
    selectedNode.lastHeartbeat = new Date();
    this.totalRequestsRouted += 1;

    // Auto-decrement active requests simulated after short delay
    setTimeout(() => {
      if (selectedNode.activeRequests > 0) {
        selectedNode.activeRequests -= 1;
      }
    }, 150);

    return selectedNode;
  }

  /**
   * Returns current status of all server nodes and load balancer state
   */
  public getMetrics() {
    return {
      strategy: "ROUND_ROBIN" as const,
      activeNodeCount: this.nodes.filter((n) => n.status === "ONLINE").length,
      totalNodes: this.nodes.length,
      totalRequestsRouted: this.totalRequestsRouted,
      currentNodeIndex: this.currentIndex,
      nodes: [...this.nodes],
    };
  }

  /**
   * Simulates setting a server node online or offline for resilience testing
   */
  public setNodeStatus(nodeId: string, status: "ONLINE" | "OFFLINE" | "DEGRADED") {
    const node = this.nodes.find((n) => n.id === nodeId || `Server ${n.port}` === nodeId);
    if (node) {
      node.status = status;
      node.lastHeartbeat = new Date();
    }
  }

  /**
   * Resets load balancer metrics
   */
  public resetMetrics() {
    this.currentIndex = 0;
    this.totalRequestsRouted = 0;
    this.nodes.forEach((n) => {
      n.activeRequests = 0;
      n.totalRouted = 0;
      n.status = "ONLINE";
      n.lastHeartbeat = new Date();
    });
  }
}

// Export Singleton Instance
export const loadBalancer = new LoadBalancerService();

"use client";

import {
  applyNodeChanges,
  Background,
  Controls,
  type EdgeMouseHandler,
  type NodeMouseHandler,
  type OnNodesChange,
  Panel,
  Position,
  ReactFlow,
  type ReactFlowJsonObject,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowDownToLine, Eye, EyeOff, FocusIcon, RotateCcw, Search } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { EdgeDetailDrawer } from "./EdgeDetailDrawer";
import { buildEdgeContext, type EdgeContext } from "./edge-context";
import { FocusBreadcrumb } from "./FocusBreadcrumb";
import { FocusToolbar } from "./FocusToolbar";
import { applyPowerFilters, computeFocusSubgraph } from "./focus";
import type { ReferralPurchaseEdge, ReferralUserFlowNode } from "./layout";
import { referralEdgeTypes, referralNodeTypes } from "./types";
import { useFocusState } from "./use-focus-state";
import "./focus.css";

const VIEWPORT_STORAGE_KEY = "onlinecompetitions:referral-network:viewport:v1";
const FOCUS_FIT_DURATION_MS = 380;
const FOCUS_FIT_PADDING = 0.22;

const initials = (text: string): string => {
  if (!text) return "?";
  const parts = text.split(/[\s@.]+/);
  return parts
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
};

function computeLayout(
  initialNodes: ReferralUserFlowNode[],
  initialEdges: ReferralPurchaseEdge[]
): { nodes: ReferralUserFlowNode[]; edges: ReferralPurchaseEdge[] } {
  const adjacency = new Map<string, string[]>();
  const incoming = new Map<string, number>();
  for (const n of initialNodes) {
    adjacency.set(n.id, []);
    incoming.set(n.id, 0);
  }
  for (const e of initialEdges) {
    if (!adjacency.has(e.source) || !adjacency.has(e.target)) continue;
    adjacency.get(e.source)!.push(e.target);
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
  }

  const nodeWidth = 240;
  const nodeHeight = 132;
  const hGap = 80;
  const vGap = 24;

  const components: string[][] = [];
  const visited = new Set<string>();
  for (const n of initialNodes) {
    if (visited.has(n.id)) continue;
    const component: string[] = [];
    const stack: string[] = [n.id];
    while (stack.length) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      component.push(cur);
      for (const child of adjacency.get(cur) ?? []) {
        if (!visited.has(child)) stack.push(child);
      }
    }
    components.push(component);
  }

  const topoSort = (comp: string[]): string[] => {
    const order: string[] = [];
    const tempVisited = new Set<string>();
    const permVisited = new Set<string>();
    const visit = (id: string) => {
      if (permVisited.has(id)) return;
      if (tempVisited.has(id)) return;
      tempVisited.add(id);
      for (const child of adjacency.get(id) ?? []) {
        if (comp.includes(child)) visit(child);
      }
      permVisited.add(id);
      order.push(id);
    };
    for (const id of comp) visit(id);
    order.reverse();
    return order;
  };

  const depthById = new Map<string, number>();
  for (const comp of components) {
    const sorted = topoSort(comp);
    for (const id of sorted) {
      const incomingCount = incoming.get(id) ?? 0;
      if (incomingCount === 0) {
        depthById.set(id, 0);
      } else {
        let maxParentDepth = 0;
        for (const e of initialEdges) {
          if (e.target === id) {
            const pd = depthById.get(e.source) ?? 0;
            if (pd >= maxParentDepth) maxParentDepth = pd + 1;
          }
        }
        depthById.set(id, maxParentDepth);
      }
    }
  }

  const byDepth = new Map<number, string[]>();
  for (const [id, depth] of depthById) {
    if (!byDepth.has(depth)) byDepth.set(depth, []);
    byDepth.get(depth)!.push(id);
  }

  const positions = new Map<string, { x: number; y: number }>();
  let xOffset = 0;
  for (const comp of components) {
    const compNodes = new Set(comp);
    let maxColumn = 0;
    const localXOffset = xOffset;
    for (const [depth, ids] of Array.from(byDepth.entries()).sort((a, b) => a[0] - b[0])) {
      const inComp = ids.filter((id) => compNodes.has(id));
      if (inComp.length === 0) continue;
      const colX = localXOffset + depth * (nodeWidth + hGap);
      inComp.forEach((id, idx) => {
        positions.set(id, {
          x: colX,
          y: idx * (nodeHeight + vGap),
        });
      });
      if (depth > maxColumn) maxColumn = depth;
    }
    xOffset += (maxColumn + 1) * (nodeWidth + hGap) + 64;
  }

  return {
    nodes: initialNodes.map((node) => ({
      ...node,
      width: nodeWidth,
      height: nodeHeight,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      position: positions.get(node.id) ?? { x: 0, y: 0 },
    })),
    edges: initialEdges,
  };
}

interface CanvasProps {
  initialData: import("@oc/api-referrals/mindmap").ReferralMindmapResponse;
  selectedUserId: string | null;
  onSelectUser: (id: string | null) => void;
  selectedEdgeId: string | null;
  onSelectEdge: (id: string | null) => void;
}

function ReferralMindmapCanvasInner({
  initialData,
  selectedUserId,
  onSelectUser,
  selectedEdgeId,
  onSelectEdge,
}: CanvasProps) {
  const initialNodes: ReferralUserFlowNode[] = useMemo(() => {
    return initialData.nodes.map((n) => mapNode(n));
  }, [initialData.nodes]);

  const initialEdges: ReferralPurchaseEdge[] = useMemo(() => {
    return initialData.edges.map((e) => mapEdge(e));
  }, [initialData.edges]);

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => computeLayout(initialNodes, initialEdges),
    [initialNodes, initialEdges]
  );

  const [nodes, setNodes] = useState<ReferralUserFlowNode[]>(layoutedNodes);
  const [edges] = useState<ReferralPurchaseEdge[]>(layoutedEdges);
  const [showInactive, setShowInactive] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [fitTick, setFitTick] = useState(0);
  const { setViewport, toObject, fitView } = useReactFlow();
  const didMount = useRef(false);

  const focusApi = useFocusState();
  const { focus } = focusApi;

  const nodeMap = useMemo(() => {
    const m = new Map<string, import("@oc/api-referrals/mindmap").ReferralMindmapNode>();
    for (const n of initialData.nodes) m.set(n.id, n);
    return m;
  }, [initialData.nodes]);

  const filteredByPowerFilter = useMemo(
    () => applyPowerFilters(initialData.nodes, focus.filters),
    [initialData.nodes, focus.filters]
  );

  const subgraph = useMemo(
    () => computeFocusSubgraph(focus, { nodes: initialData.nodes, edges: initialData.edges }),
    [focus, initialData.nodes, initialData.edges]
  );

  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;
    try {
      const raw = window.localStorage.getItem(VIEWPORT_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as ReactFlowJsonObject;
        if (saved.viewport) {
          setViewport(saved.viewport, { duration: 0 });
        }
      }
    } catch {
      window.localStorage.removeItem(VIEWPORT_STORAGE_KEY);
    }
  }, [setViewport]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        fitView({
          padding: 0.18,
          duration: 0,
          maxZoom: 1,
        });
      } catch {
        // ignore: react flow may not have measured yet
      }
    }, 50);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitTick]);

  const focusedSet = subgraph.focusedNodeIds;
  const focusedEdgeSet = subgraph.focusedEdgeIds;
  const hasFocus = focus.focusedNodeIds.length > 0;
  const hasFilter = focus.filters.length > 0;

  const filteredEdges = useMemo(() => {
    const base = showInactive
      ? edges
      : edges.filter((e) => e.data?.isActive !== false || e.data?.edgeKind === "signup_only");
    if (!hasFilter) return base;
    return base.filter(
      (e) => filteredByPowerFilter.has(e.source) && filteredByPowerFilter.has(e.target)
    );
  }, [edges, showInactive, hasFilter, filteredByPowerFilter]);

  const visibleNodes = useMemo<ReferralUserFlowNode[]>(() => {
    const connectedIds = new Set<string>();
    for (const e of filteredEdges) {
      connectedIds.add(e.source);
      connectedIds.add(e.target);
    }

    let candidates: ReferralUserFlowNode[];
    if (hasFocus) {
      candidates = nodes.filter((n) => focusedSet.has(n.id));
    } else if (showInactive && !hasFilter) {
      candidates = nodes;
    } else {
      const candidateIds = new Set<string>();
      for (const e of filteredEdges) {
        candidateIds.add(e.source);
        candidateIds.add(e.target);
      }
      for (const n of nodes) {
        if (n.data.isRoot && !hasFilter) candidateIds.add(n.id);
      }
      candidates = nodes.filter((n) => candidateIds.has(n.id));
    }

    if (searchValue.trim()) {
      const needle = searchValue.trim().toLowerCase();
      candidates = candidates.filter((n) => {
        const email = (n.data.email ?? "").toLowerCase();
        const name = (n.data.displayName ?? "").toLowerCase();
        return email.includes(needle) || name.includes(needle);
      });
    }

    return candidates.map((n) => {
      const isFocused = focusedSet.has(n.id);
      const isRootFocused = isFocused && n.data.isRoot;
      const className = cn("rfn-node", isFocused && "rfn-focus", isRootFocused && "rfn-focus-root");
      return {
        ...n,
        selected: n.id === selectedUserId,
        className,
      };
    });
  }, [
    nodes,
    filteredEdges,
    showInactive,
    searchValue,
    selectedUserId,
    focusedSet,
    hasFocus,
    hasFilter,
  ]);

  const visibleEdges = useMemo<ReferralPurchaseEdge[]>(() => {
    if (!hasFocus) return filteredEdges;
    return filteredEdges
      .filter((e) => focusedEdgeSet.has(e.id))
      .map((e) => ({
        ...e,
        className: "rfn-edge-focus",
      }));
  }, [filteredEdges, hasFocus, focusedEdgeSet]);

  const onNodesChange = useCallback<OnNodesChange<ReferralUserFlowNode>>((changes) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
  }, []);

  const focusCounter = `${subgraph.focusedNodeIds.size} nodes · ${subgraph.focusedEdgeIds.size} edges`;

  const focusedNodeNames = useMemo(() => {
    return focus.focusedNodeIds.map((id) => {
      const n = nodeMap.get(id);
      return n?.displayName || n?.email || id;
    });
  }, [focus.focusedNodeIds, nodeMap]);

  const edgeContext = useMemo<EdgeContext | null>(() => {
    if (!selectedEdgeId) return null;
    const edge = initialData.edges.find((e) => e.id === selectedEdgeId);
    if (!edge) return null;
    return buildEdgeContext(edge, nodeMap, {
      activityWindowDays: initialData.meta.settings.activityWindowDays,
      monthlyCutoffDay: initialData.meta.settings.monthlyCutoffDay,
    });
  }, [selectedEdgeId, initialData.edges, initialData.meta.settings, nodeMap]);

  const handleNodeClick = useCallback<NodeMouseHandler>(
    (_, node) => {
      onSelectUser(node.id);
    },
    [onSelectUser]
  );

  const handleNodeContextMenu = useCallback<NodeMouseHandler>(
    (event, node) => {
      event.preventDefault();
      const additive = event.shiftKey;
      if (additive) {
        focusApi.toggleFocusedNode(node.id);
      } else if (focus.focusedNodeIds.length === 1 && focus.focusedNodeIds[0] === node.id) {
        focusApi.clearFocus();
      } else {
        focusApi.setFocusedNodes([node.id]);
      }
    },
    [focusApi, focus.focusedNodeIds]
  );

  const handleEdgeClick = useCallback<EdgeMouseHandler>(
    (_, edge) => {
      onSelectUser(null);
      onSelectEdge(edge.id);
    },
    [onSelectUser, onSelectEdge]
  );

  const handlePaneClick = useCallback(() => {
    onSelectUser(null);
    onSelectEdge(null);
    if (hasFocus) focusApi.clearFocus();
  }, [onSelectUser, onSelectEdge, focusApi, hasFocus]);

  const saveView = useCallback(() => {
    try {
      window.localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(toObject()));
    } catch {
      // ignore
    }
  }, [toObject]);

  const resetView = useCallback(() => {
    window.localStorage.removeItem(VIEWPORT_STORAGE_KEY);
    setFitTick((t) => t + 1);
  }, []);

  const fitFocused = useCallback(() => {
    if (!hasFocus) return;
    const ids = Array.from(focusedSet);
    const targets = nodes.filter((n) => ids.includes(n.id));
    if (targets.length === 0) return;
    try {
      fitView({
        nodes: targets.map((n) => ({
          id: n.id,
          position: n.position,
          width: n.width,
          height: n.height,
        })),
        padding: FOCUS_FIT_PADDING,
        duration: FOCUS_FIT_DURATION_MS,
        maxZoom: 1,
      });
    } catch {
      // ignore: react flow may not have measured yet
    }
  }, [hasFocus, focusedSet, nodes, fitView]);

  useEffect(() => {
    if (!hasFocus) return;
    const t = window.setTimeout(fitFocused, 80);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.focusedNodeIds, focus.direction, focus.radius, hasFocus, fitFocused]);

  useEffect(() => {
    function onFocusEvent(event: Event) {
      const detail = (event as CustomEvent<{ id: string; additive: boolean }>).detail;
      if (!detail) return;
      if (detail.additive) {
        focusApi.toggleFocusedNode(detail.id);
      } else if (focus.focusedNodeIds.length === 1 && focus.focusedNodeIds[0] === detail.id) {
        focusApi.clearFocus();
      } else {
        focusApi.setFocusedNodes([detail.id]);
      }
    }
    window.addEventListener("referral-focus-node", onFocusEvent);
    return () => window.removeEventListener("referral-focus-node", onFocusEvent);
  }, [focusApi, focus.focusedNodeIds]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selectedEdgeId) {
          e.preventDefault();
          onSelectEdge(null);
          return;
        }
        if (hasFocus) {
          e.preventDefault();
          focusApi.clearFocus();
          onSelectUser(null);
        } else if (selectedUserId) {
          onSelectUser(null);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusApi, hasFocus, onSelectUser, onSelectEdge, selectedEdgeId, selectedUserId]);

  const handleRemoveFocusedNode = useCallback(
    (id: string) => {
      const remaining = focus.focusedNodeIds.filter((x) => x !== id);
      focusApi.setFocusedNodes(remaining);
    },
    [focusApi, focus.focusedNodeIds]
  );

  return (
    <div
      className="referral-focus-canvas relative h-full min-h-0 w-full overflow-hidden rounded-lg border bg-background"
      onContextMenu={(e) => {
        if ((e.target as HTMLElement | null)?.closest(".react-flow__node")) return;
        e.preventDefault();
      }}
    >
      <ReactFlow<ReferralUserFlowNode, ReferralPurchaseEdge>
        nodes={visibleNodes}
        edges={visibleEdges}
        nodeTypes={referralNodeTypes}
        edgeTypes={referralEdgeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        nodesConnectable={false}
        edgesReconnectable={false}
        edgesFocusable
        nodesDraggable={false}
        nodesFocusable
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
        minZoom={0.15}
        maxZoom={1}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} />
        <Controls position="bottom-left" showInteractive={false} />

        <Panel position="top-center" className="flex max-w-[600px] flex-col gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-background/90 p-2 shadow-sm backdrop-blur">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email or name…"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="h-8 w-64 text-xs"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={showInactive}
                    onCheckedChange={setShowInactive}
                    aria-label="Show inactive edges"
                  />
                  {showInactive ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {showInactive ? "Showing active and inactive edges" : "Showing active edges only"}
              </TooltipContent>
            </Tooltip>
          </div>

          <FocusToolbar
            state={focus}
            nodes={initialData.nodes}
            focusedNodeNames={focusedNodeNames}
            focusedNodeCount={subgraph.focusedNodeIds.size}
            focusedEdgeCount={subgraph.focusedEdgeIds.size}
            truncated={subgraph.truncated}
            onSetRadius={focusApi.setRadius}
            onSetDirection={focusApi.setDirection}
            onToggleFilter={focusApi.toggleFilter}
            onClearFilters={focusApi.clearFilters}
            onClearFocus={focusApi.clearFocus}
            onResetAll={focusApi.resetAll}
            onRemoveFocusedNode={handleRemoveFocusedNode}
          />

          <FocusBreadcrumb
            lineagePath={subgraph.lineagePath}
            nodeMap={nodeMap}
            onFocusAncestor={(id) => focusApi.setFocusedNodes([id])}
          />
        </Panel>

        <Panel position="bottom-left" className="flex flex-col items-start gap-2">
          <MindmapLegend />
        </Panel>

        <Panel position="top-right" className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={resetView} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={saveView} className="gap-1.5">
            <ArrowDownToLine className="h-3.5 w-3.5" />
            Save view
          </Button>
        </Panel>

        <Panel
          position="bottom-right"
          className="flex items-center gap-2 text-[11px] text-muted-foreground"
        >
          <FocusIcon className="h-3 w-3" />
          {hasFocus
            ? `${focusCounter} (of ${initialData.meta.totalNodes} users · ${initialData.meta.totalEdges} edges)`
            : `${initialData.meta.totalNodes} users · ${initialData.meta.totalEdges} edges`}
        </Panel>
      </ReactFlow>

      <EdgeDetailDrawer
        open={!!edgeContext}
        onOpenChange={(open) => {
          if (!open) onSelectEdge(null);
        }}
        ctx={edgeContext}
        onFocusUser={(id) => {
          focusApi.setFocusedNodes([id]);
        }}
      />
    </div>
  );
}

function mapNode(
  n: import("@oc/api-referrals/mindmap").ReferralMindmapNode
): ReferralUserFlowNode {
  const tone: ReferralUserFlowNode["data"]["tone"] = n.isRoot
    ? "root"
    : n.activeRefereeCount > 0
      ? "active"
      : n.totalReferralSpendGBP === 0
        ? "inactive"
        : "pending";

  return {
    id: n.id,
    type: "referralUser",
    data: {
      email: n.email,
      displayName: n.displayName && n.displayName.length > 0 ? n.displayName : initials(n.email),
      firstName: n.firstName,
      lastName: n.lastName,
      country: n.country,
      isVerified: n.isVerified,
      isAdmin: n.isAdmin,
      activeRefereeCount: n.activeRefereeCount,
      totalRefereeCount: n.referralCount,
      ticketsMinted: n.ticketsMinted,
      totalSpentGBP: n.totalSpent,
      isRoot: n.isRoot,
      tierBadge: n.currentTier,
      avatarSeed: n.email,
      tone,
      subscriptionStatus: n.subscriptionStatus,
      lastActiveAt: n.lastAwardAt,
    },
    position: { x: 0, y: 0 },
  };
}

function mapEdge(
  e: import("@oc/api-referrals/mindmap").ReferralMindmapEdge
): ReferralPurchaseEdge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    type: "referralPurchase",
    data: {
      purchasedAt: e.purchasedAt,
      purchaseAmountGBP: e.purchaseAmountGBP,
      ticketsAwarded: e.ticketsAwarded,
      orderNumber: e.orderNumber,
      isActive: e.isActive,
      edgeKind: e.edgeKind,
    },
    selected: false,
  };
}

function MindmapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-background/90 px-3 py-1.5 text-[10px] text-muted-foreground shadow-sm backdrop-blur">
      <span className="flex items-center gap-1">
        <span className="h-3 w-3 rounded-full border-2 border-amber-500 bg-amber-500/20" />
        Root
      </span>
      <span className="flex items-center gap-1">
        <span className="h-3 w-3 rounded-full border-2 border-emerald-500 bg-emerald-500/10" />
        Active
      </span>
      <span className="flex items-center gap-1">
        <span className="h-3 w-3 rounded-full border-2 border-muted-foreground/40 bg-muted/30" />
        Inactive
      </span>
      <span className="flex items-center gap-1">
        <span className="block h-px w-4 bg-emerald-500" />
        Active edge
      </span>
      <span className="flex items-center gap-1">
        <span
          className="block h-px w-4 bg-muted-foreground/40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, currentColor 0 4px, transparent 4px 8px)",
          }}
        />
        Inactive
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full border border-primary bg-primary/30 ring-2 ring-primary/30" />
        Focused
      </span>
    </div>
  );
}

export const ReferralMindmapCanvas = memo(function ReferralMindmapCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <ReferralMindmapCanvasInner {...props} />
    </ReactFlowProvider>
  );
});

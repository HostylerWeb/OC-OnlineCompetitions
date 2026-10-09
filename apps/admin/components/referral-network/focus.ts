import type { ReferralMindmapEdge, ReferralMindmapNode } from "@oc/api-referrals/mindmap";

export type FocusDirection = "down" | "up" | "both" | "all";

export type SimplePowerFilterKey =
  | "ticket_earners"
  | "inactive_referrers"
  | "admins"
  | "verified"
  | "subscribers"
  | "recent";

export type ConstraintPowerFilterKey =
  | `country:${string}`
  | `tier_min:${number}`
  | `spend_min:${number}`;

export type PowerFilterKey = SimplePowerFilterKey | ConstraintPowerFilterKey;

export const SIMPLE_FILTER_KEYS: readonly SimplePowerFilterKey[] = [
  "ticket_earners",
  "inactive_referrers",
  "admins",
  "verified",
  "subscribers",
  "recent",
] as const;

export interface FocusState {
  focusedNodeIds: string[];
  radius: number;
  direction: FocusDirection;
  filters: PowerFilterKey[];
}

export const DEFAULT_FOCUS_STATE: FocusState = {
  focusedNodeIds: [],
  radius: Number.POSITIVE_INFINITY,
  direction: "down",
  filters: [],
};

export const MAX_FOCUSED_NODES = 50;
export const MAX_FOCUSED_SUBGRAPH = 500;
const MAX_FILTERS = 12;
const RECENT_WINDOW_MS = 30 * 86400_000;
const COUNTRY_PREFIX = "country:";
const TIER_PREFIX = "tier_min:";
const SPEND_PREFIX = "spend_min:";

export const COUNTRY_FILTER_PREFIX = COUNTRY_PREFIX;
export const TIER_MIN_FILTER_PREFIX = TIER_PREFIX;
export const SPEND_MIN_FILTER_PREFIX = SPEND_PREFIX;

export interface SubgraphResult {
  focusedNodeIds: Set<string>;
  focusedEdgeIds: Set<string>;
  lineagePath: string[];
  truncated: boolean;
}

export interface FocusContext {
  nodes: ReferralMindmapNode[];
  edges: ReferralMindmapEdge[];
}

export function computeFocusSubgraph(state: FocusState, ctx: FocusContext): SubgraphResult {
  if (state.focusedNodeIds.length === 0) {
    return {
      focusedNodeIds: new Set(),
      focusedEdgeIds: new Set(),
      lineagePath: [],
      truncated: false,
    };
  }

  const { nodes, edges } = ctx;
  const nodeMap = new Map<string, ReferralMindmapNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  const validFocused = state.focusedNodeIds
    .filter((id) => nodeMap.has(id))
    .slice(0, MAX_FOCUSED_NODES);
  if (validFocused.length === 0) {
    return {
      focusedNodeIds: new Set(),
      focusedEdgeIds: new Set(),
      lineagePath: [],
      truncated: false,
    };
  }

  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    pushToMap(outgoing, e.source, e.target);
    pushToMap(incoming, e.target, e.source);
  }

  const focused = new Set<string>(validFocused);
  let truncated = false;

  const stop = () => focused.size >= MAX_FOCUSED_SUBGRAPH;

  if (state.direction === "up") {
    walkAncestors(validFocused, incoming, focused, state.radius, stop);
    truncated = focused.size >= MAX_FOCUSED_SUBGRAPH;
  } else if (state.direction === "down") {
    walkDescendants(validFocused, outgoing, focused, state.radius, stop);
    truncated = focused.size >= MAX_FOCUSED_SUBGRAPH;
  } else if (state.direction === "both") {
    walkAncestors(validFocused, incoming, focused, state.radius, stop);
    walkDescendants(validFocused, outgoing, focused, state.radius, stop);
    truncated = focused.size >= MAX_FOCUSED_SUBGRAPH;
  } else {
    walkAllDirections(validFocused, outgoing, incoming, focused, state.radius, stop);
    truncated = focused.size >= MAX_FOCUSED_SUBGRAPH;
  }

  const focusedEdgeIds = new Set<string>();
  for (const e of edges) {
    if (focused.has(e.source) && focused.has(e.target)) {
      focusedEdgeIds.add(e.id);
    }
  }

  const lineagePath =
    validFocused.length === 1 && state.direction !== "all"
      ? computeLineagePath(validFocused[0]!, nodeMap)
      : [];

  return { focusedNodeIds: focused, focusedEdgeIds, lineagePath, truncated };
}

function pushToMap(map: Map<string, string[]>, key: string, value: string) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function walkDescendants(
  starts: string[],
  outgoing: Map<string, string[]>,
  out: Set<string>,
  radius: number,
  stop: () => boolean
) {
  for (const startId of starts) {
    const visited = new Set<string>([startId]);
    const stack: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
    while (stack.length) {
      if (stop()) return;
      const cur = stack.pop()!;
      if (radius !== Number.POSITIVE_INFINITY && cur.depth >= radius) continue;
      const children = outgoing.get(cur.id) ?? [];
      for (const c of children) {
        if (visited.has(c)) continue;
        visited.add(c);
        out.add(c);
        stack.push({ id: c, depth: cur.depth + 1 });
      }
    }
  }
}

function walkAncestors(
  starts: string[],
  incoming: Map<string, string[]>,
  out: Set<string>,
  radius: number,
  stop: () => boolean
) {
  for (const startId of starts) {
    const visited = new Set<string>([startId]);
    const stack: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
    while (stack.length) {
      if (stop()) return;
      const cur = stack.pop()!;
      if (radius !== Number.POSITIVE_INFINITY && cur.depth >= radius) continue;
      const parents = incoming.get(cur.id) ?? [];
      for (const p of parents) {
        if (visited.has(p)) continue;
        visited.add(p);
        out.add(p);
        stack.push({ id: p, depth: cur.depth + 1 });
      }
    }
  }
}

function walkAllDirections(
  starts: string[],
  outgoing: Map<string, string[]>,
  incoming: Map<string, string[]>,
  out: Set<string>,
  radius: number,
  stop: () => boolean
) {
  for (const startId of starts) {
    const visited = new Set<string>([startId]);
    const stack: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
    while (stack.length) {
      if (stop()) return;
      const cur = stack.pop()!;
      if (radius !== Number.POSITIVE_INFINITY && cur.depth >= radius) continue;
      const neighbours = [...(outgoing.get(cur.id) ?? []), ...(incoming.get(cur.id) ?? [])];
      for (const n of neighbours) {
        if (visited.has(n)) continue;
        visited.add(n);
        out.add(n);
        stack.push({ id: n, depth: cur.depth + 1 });
      }
    }
  }
}

function computeLineagePath(startId: string, nodeMap: Map<string, ReferralMindmapNode>): string[] {
  const path: string[] = [startId];
  const visited = new Set<string>([startId]);
  let cur = startId;
  while (true) {
    const node = nodeMap.get(cur);
    if (!node) break;
    if (node.parentIds.length === 0 || node.isRoot) break;
    const next = node.parentIds[0]!;
    if (visited.has(next)) break;
    visited.add(next);
    path.unshift(next);
    cur = next;
  }
  return path;
}

export function applyPowerFilters(
  nodes: ReferralMindmapNode[],
  filters: PowerFilterKey[]
): Set<string> {
  if (filters.length === 0) return new Set(nodes.map((n) => n.id));

  const countryFilters: string[] = [];
  let tierMin: number | null = null;
  let spendMin: number | null = null;
  const simple = new Set<SimplePowerFilterKey>();

  for (const f of filters) {
    if (f.startsWith(COUNTRY_PREFIX)) {
      countryFilters.push(f.slice(COUNTRY_PREFIX.length));
    } else if (f.startsWith(TIER_PREFIX)) {
      const v = Number(f.slice(TIER_PREFIX.length));
      if (Number.isFinite(v)) tierMin = v;
    } else if (f.startsWith(SPEND_PREFIX)) {
      const v = Number(f.slice(SPEND_PREFIX.length));
      if (Number.isFinite(v)) spendMin = v;
    } else if ((SIMPLE_FILTER_KEYS as readonly string[]).includes(f)) {
      simple.add(f as SimplePowerFilterKey);
    }
  }

  const result = new Set<string>();
  const now = Date.now();

  for (const node of nodes) {
    if (countryFilters.length > 0 && !countryFilters.includes(node.country ?? "")) continue;
    if (tierMin !== null && (node.currentTier ?? 0) < tierMin) continue;
    if (spendMin !== null && node.totalSpent < spendMin) continue;

    if (simple.size > 0) {
      let pass = false;
      if (simple.has("ticket_earners") && node.ticketsMinted >= 1) pass = true;
      if (
        simple.has("inactive_referrers") &&
        node.referralCount >= 1 &&
        node.activeRefereeCount === 0
      )
        pass = true;
      if (simple.has("admins") && node.isAdmin) pass = true;
      if (simple.has("verified") && node.isVerified) pass = true;
      if (simple.has("subscribers") && node.subscriptionStatus === "active") pass = true;
      if (simple.has("recent") && now - new Date(node.createdAt).getTime() <= RECENT_WINDOW_MS)
        pass = true;
      if (!pass) continue;
    }

    result.add(node.id);
  }

  return result;
}

const FOCUS_PARAM = "focus";
const RADIUS_PARAM = "radius";
const DIR_PARAM = "dir";
const FILTERS_PARAM = "filters";
const EDGE_PARAM = "edge";

export function parseFocusFromUrl(params: URLSearchParams): FocusState {
  const focusedRaw = params.get(FOCUS_PARAM);
  const focusedNodeIds = focusedRaw
    ? Array.from(new Set(focusedRaw.split(",").filter(Boolean))).slice(0, MAX_FOCUSED_NODES)
    : [];

  const radiusRaw = params.get(RADIUS_PARAM);
  let radius = Number.POSITIVE_INFINITY;
  if (radiusRaw !== null) {
    if (radiusRaw === "inf" || radiusRaw === "all") {
      radius = Number.POSITIVE_INFINITY;
    } else {
      const n = Number(radiusRaw);
      if (Number.isFinite(n) && n >= 0) radius = Math.min(n, 8);
    }
  }

  const dirRaw = params.get(DIR_PARAM);
  const direction: FocusDirection =
    dirRaw === "up" || dirRaw === "down" || dirRaw === "both" || dirRaw === "all" ? dirRaw : "down";

  const filtersRaw = params.get(FILTERS_PARAM);
  const filters: PowerFilterKey[] = filtersRaw
    ? (filtersRaw
        .split(",")
        .map((s) => s.trim())
        .filter(isPowerFilterKey)
        .slice(0, MAX_FILTERS) as PowerFilterKey[])
    : [];

  return { focusedNodeIds, radius, direction, filters };
}

export function serializeFocusToUrl(state: FocusState, existing: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(existing.toString());
  if (state.focusedNodeIds.length > 0) {
    next.set(FOCUS_PARAM, state.focusedNodeIds.join(","));
  } else {
    next.delete(FOCUS_PARAM);
  }

  if (!Number.isFinite(state.radius)) {
    next.delete(RADIUS_PARAM);
  } else {
    next.set(RADIUS_PARAM, String(state.radius));
  }

  if (state.direction === "down") {
    next.delete(DIR_PARAM);
  } else {
    next.set(DIR_PARAM, state.direction);
  }

  if (state.filters.length > 0) {
    next.set(FILTERS_PARAM, state.filters.join(","));
  } else {
    next.delete(FILTERS_PARAM);
  }

  return next;
}

export const EDGE_URL_PARAM = EDGE_PARAM;

export function readEdgeIdFromUrl(params: URLSearchParams): string | null {
  const raw = params.get(EDGE_PARAM);
  return raw && raw.length > 0 ? raw : null;
}

export function setEdgeIdInUrl(existing: URLSearchParams, edgeId: string | null): URLSearchParams {
  const next = new URLSearchParams(existing.toString());
  if (edgeId) {
    next.set(EDGE_PARAM, edgeId);
  } else {
    next.delete(EDGE_PARAM);
  }
  return next;
}

export function isPowerFilterKey(value: string): value is PowerFilterKey {
  if ((SIMPLE_FILTER_KEYS as readonly string[]).includes(value)) return true;
  if (value.startsWith(COUNTRY_PREFIX) && value.length > COUNTRY_PREFIX.length) return true;
  if (value.startsWith(TIER_PREFIX)) {
    const v = Number(value.slice(TIER_PREFIX.length));
    return Number.isFinite(v) && v >= 0 && v <= 99;
  }
  if (value.startsWith(SPEND_PREFIX)) {
    const v = Number(value.slice(SPEND_PREFIX.length));
    return Number.isFinite(v) && v >= 0;
  }
  return false;
}

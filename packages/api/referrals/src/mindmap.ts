import { Order, Profile, ReferralPurchase, ReferralSettings } from "@oc/api-db/models";
import mongoose from "mongoose";
import { getReferrerUniqueActiveCount, type LeaderboardOptions } from "./leaderboard";
import { findCurrentTier, isQualifyingReferralPurchase, sortTiers } from "./referral-tier-math";

export interface ReferralMindmapNode {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  avatarUrl?: string;
  country?: string;
  isVerified: boolean;
  isAdmin: boolean;
  isGuestCheckout?: boolean;
  subscriptionStatus: "active" | "cancelled" | "none";
  subscriptionTier: "25" | "50" | "100" | null;
  createdAt: string;
  totalSpent: number;
  totalEntries: number;
  winsCount: number;
  referralCode: string;
  referralMultiplier: number;
  referralCount: number;
  activeRefereeCount: number;
  pendingRefereeCount: number;
  ticketsMinted: number;
  totalReferralSpendGBP: number;
  referralWalletBalance: number;
  referralWalletPending: number;
  lastAwardAt?: string;
  currentTier: number | null;
  nextTier: number | null;
  referralsToNextTier: number | null;
  parentIds: string[];
  depth: number;
  isRoot: boolean;
  hasChildren: boolean;
  childCount: number;
}

export interface ReferralMindmapEdge {
  id: string;
  source: string;
  target: string;
  orderId: string;
  orderNumber?: number;
  purchaseAmountGBP: number;
  purchasedAt: string;
  ticketsAwarded: number;
  ticketsAwardedAt?: string;
  tierAtAward?: number;
  isActive: boolean;
  edgeKind: "referral_purchase" | "signup_only";
}

export interface ReferralMindmapMeta {
  totalNodes: number;
  totalEdges: number;
  maxDepthReached: number;
  truncated: boolean;
  settings: {
    activityWindowDays: number;
    activityWindowMode: "rolling" | "fixed_day_of_month";
    monthlyCutoffDay: number;
    minFirstOrderSpend: number;
    tiers: Array<{ threshold: number; tickets: number; label?: string }>;
  };
}

export interface ReferralMindmapResponse {
  nodes: ReferralMindmapNode[];
  edges: ReferralMindmapEdge[];
  meta: ReferralMindmapMeta;
}

export interface ReferralMindmapOptions {
  rootUserId?: string;
  depth?: number;
  minFirstOrderSpend?: number;
  activityWindowDays?: number;
  includeInactive?: boolean;
  includeDeleted?: boolean;
}

const DEFAULT_DEPTH = 5;
const MAX_NODES = 1500;

interface ResolvedSettings {
  activityWindowDays: number;
  activityWindowMode: "rolling" | "fixed_day_of_month";
  monthlyCutoffDay: number;
  minFirstOrderSpend: number;
  graceEnabled: boolean;
  graceDays: number;
  tiers: Array<{ threshold: number; tickets: number; label?: string }>;
}

interface OrderIdEntry {
  orderId: string;
  orderNumber?: number;
  orderKey: string;
}

async function resolveSettings(opts: ReferralMindmapOptions): Promise<ResolvedSettings> {
  const doc = await ReferralSettings.findById("referral_settings").lean();
  return {
    activityWindowDays: opts.activityWindowDays ?? (doc?.activityWindowDays as number) ?? 30,
    activityWindowMode: (doc?.activityWindowMode as "rolling" | "fixed_day_of_month") ?? "rolling",
    monthlyCutoffDay: (doc?.monthlyCutoffDay as number) ?? 28,
    minFirstOrderSpend: opts.minFirstOrderSpend ?? (doc?.minFirstOrderSpend as number) ?? 1,
    graceEnabled: !!((doc?.gracePeriod as Record<string, unknown> | undefined)?.enabled ?? false),
    graceDays: ((doc?.gracePeriod as Record<string, unknown> | undefined)?.days as number) ?? 0,
    tiers:
      (doc?.tiers as Array<{
        threshold: number;
        tickets: number;
        label?: string;
      }>) ?? [],
  };
}

export async function getReferralMindmap(
  options: ReferralMindmapOptions = {}
): Promise<ReferralMindmapResponse> {
  const depth = Math.min(Math.max(options.depth ?? DEFAULT_DEPTH, 1), 8);
  const s = await resolveSettings(options);
  const includeDeleted = options.includeDeleted === true;
  const includeInactive = options.includeInactive === true;
  const rootUserId = options.rootUserId;

  const rootOid = rootUserId ? new mongoose.Types.ObjectId(rootUserId) : null;

  const purchases = await ReferralPurchase.find(includeDeleted ? {} : { deletedAt: null })
    .sort({ purchasedAt: 1 })
    .lean();

  const orderIds = Array.from(new Set(purchases.map((p) => p.orderId.toString())));

  const orders = orderIds.length
    ? await Order.find({ _id: { $in: orderIds } })
        .select({ _id: 1, orderNumber: 1 })
        .lean()
    : [];
  const orderMetaMap = new Map<string, OrderIdEntry>();
  for (const o of orders) {
    orderMetaMap.set(o._id.toString(), {
      orderId: o._id.toString(),
      orderNumber: o.orderNumber,
      orderKey: o._id.toString(),
    });
  }

  const relevantUserIds = new Set<string>();
  for (const p of purchases) {
    relevantUserIds.add(p.referrerId.toString());
    relevantUserIds.add(p.referredUserId.toString());
  }

  if (rootOid) {
    relevantUserIds.add(rootOid.toString());
  }

  const profiles = relevantUserIds.size
    ? await Profile.find({ _id: { $in: Array.from(relevantUserIds) } }).lean()
    : [];
  const profileMap = new Map<string, Record<string, unknown>>();
  for (const p of profiles) {
    profileMap.set(p._id.toString(), p as unknown as Record<string, unknown>);
  }

  const graph = new Map<string, { parents: Set<string>; children: Set<string> }>();
  for (const p of purchases) {
    const source = p.referrerId.toString();
    const target = p.referredUserId.toString();
    if (!graph.has(source)) graph.set(source, { parents: new Set(), children: new Set() });
    if (!graph.has(target)) graph.set(target, { parents: new Set(), children: new Set() });
    graph.get(source)!.children.add(target);
    graph.get(target)!.parents.add(source);
  }

  const rootIds: string[] = [];
  let limitedIds: string[];
  let truncated: boolean;
  let computedMaxDepth: number;

  if (rootOid) {
    rootIds.push(rootOid.toString());
    if (graph.has(rootIds[0]!)) {
      const queue: Array<{ id: string; d: number }> = [{ id: rootIds[0]!, d: 0 }];
      const visited = new Set<string>([rootIds[0]!]);
      const reachable: string[] = [rootIds[0]!];
      let maxDepthReached = 0;
      while (queue.length && reachable.length < MAX_NODES) {
        const current = queue.shift()!;
        if (current.d >= depth) continue;
        const node = graph.get(current.id);
        if (!node) continue;
        for (const child of node.children) {
          if (!visited.has(child)) {
            visited.add(child);
            reachable.push(child);
            queue.push({ id: child, d: current.d + 1 });
            maxDepthReached = Math.max(maxDepthReached, current.d + 1);
          }
        }
      }
      limitedIds = reachable;
      truncated = reachable.length >= MAX_NODES || maxDepthReached >= depth;
      computedMaxDepth = maxDepthReached;
    } else {
      limitedIds = [rootIds[0]!];
      truncated = false;
      computedMaxDepth = 0;
    }
  } else {
    const allIds = new Set<string>();
    for (const p of purchases) {
      allIds.add(p.referrerId.toString());
      allIds.add(p.referredUserId.toString());
    }
    for (const id of allIds) {
      const node = graph.get(id);
      if (!node || node.parents.size === 0) rootIds.push(id);
    }
    limitedIds = Array.from(allIds);
    truncated = limitedIds.length >= MAX_NODES;
    computedMaxDepth = depth;
  }

  const depthById = new Map<string, number>();
  for (const id of limitedIds) {
    const node = graph.get(id);
    if (!node || node.parents.size === 0 || rootOid) {
      depthById.set(id, 0);
    } else {
      let minParentDepth = Number.POSITIVE_INFINITY;
      for (const parent of node.parents) {
        const pd = depthById.get(parent);
        if (pd !== undefined && pd < minParentDepth) minParentDepth = pd;
      }
      depthById.set(id, minParentDepth + 1);
    }
  }

  const limitSet = new Set(limitedIds);

  const edges: ReferralMindmapEdge[] = [];
  const seenEdges = new Set<string>();
  for (const p of purchases) {
    const source = p.referrerId.toString();
    const target = p.referredUserId.toString();
    if (!limitSet.has(source) || !limitSet.has(target)) continue;
    const edgeKey = `${source}->${target}`;
    if (seenEdges.has(edgeKey)) continue;
    seenEdges.add(edgeKey);

    const referredProfile = profileMap.get(target);
    const referredCreatedAt = referredProfile?.createdAt
      ? new Date(referredProfile.createdAt as Date)
      : undefined;
    const isActive =
      !!referredCreatedAt &&
      isQualifyingReferralPurchase(
        {
          purchasedAt: new Date(p.purchasedAt),
          referredUserId: p.referredUserId,
          purchaseAmount: p.purchaseAmount,
        },
        referredCreatedAt
          ? {
              _id: p.referredUserId,
              createdAt: referredCreatedAt,
              totalSpent: p.purchaseAmount,
            }
          : undefined,
        {
          mode: s.activityWindowMode,
          rollingDays: s.activityWindowDays,
          cutoffDay: s.monthlyCutoffDay,
          graceEnabled: s.graceEnabled,
          graceDays: s.graceDays,
          graceCountsToward: "next",
        },
        s.minFirstOrderSpend
      );

    if (!includeInactive && !isActive) continue;

    const orderMeta = orderMetaMap.get(p.orderId.toString());
    edges.push({
      id: p._id.toString(),
      source,
      target,
      orderId: p.orderId.toString(),
      orderNumber: orderMeta?.orderNumber,
      purchaseAmountGBP: Number(p.purchaseAmount) || 0,
      purchasedAt: new Date(p.purchasedAt).toISOString(),
      ticketsAwarded: p.ticketsAwarded ?? 0,
      ticketsAwardedAt: p.ticketsAwardedAt ? new Date(p.ticketsAwardedAt).toISOString() : undefined,
      tierAtAward: p.tierAtAward ?? undefined,
      isActive,
      edgeKind: "referral_purchase",
    });
  }

  function isDescendant(
    ancestorId: string,
    descendantId: string,
    visited: Set<string> = new Set()
  ): boolean {
    if (ancestorId === descendantId) return false;
    if (visited.has(ancestorId)) return false;
    visited.add(ancestorId);
    const node = graph.get(ancestorId);
    if (!node) return false;
    if (node.children.has(descendantId)) return true;
    for (const child of node.children) {
      if (isDescendant(child, descendantId, visited)) return true;
    }
    return false;
  }

  for (const nodeId of limitedIds) {
    const profile = profileMap.get(nodeId);
    if (!profile) continue;
    const signupReferrerId = (
      profile.referredBySignup as mongoose.Types.ObjectId | undefined
    )?.toString();
    if (!signupReferrerId || signupReferrerId === nodeId) continue;
    if (!limitSet.has(signupReferrerId)) continue;
    if (seenEdges.has(`${signupReferrerId}->${nodeId}-signup`)) continue;
    if (seenEdges.has(`${signupReferrerId}->${nodeId}`)) continue;
    const sourceNode = graph.get(signupReferrerId);
    if (sourceNode?.children.has(nodeId)) {
      seenEdges.add(`${signupReferrerId}->${nodeId}-signup`);
      continue;
    }
    if (isDescendant(nodeId, signupReferrerId)) {
      // would form a cycle (target can already reach the source)
      seenEdges.add(`${signupReferrerId}->${nodeId}-signup`);
      continue;
    }
    seenEdges.add(`${signupReferrerId}->${nodeId}-signup`);
    const referredCreatedAt = new Date(profile.createdAt as Date);
    edges.push({
      id: `${signupReferrerId}->${nodeId}-signup`,
      source: signupReferrerId,
      target: nodeId,
      orderId: "",
      purchaseAmountGBP: 0,
      purchasedAt: referredCreatedAt.toISOString(),
      ticketsAwarded: 0,
      isActive: false,
      edgeKind: "signup_only",
    });
  }

  const activeCounts = await Promise.all(
    limitedIds.map((id) =>
      getReferrerUniqueActiveCount(id, { includeDeleted } as LeaderboardOptions).then(
        (c) => [id, c] as const
      )
    )
  );
  const activeCountMap = new Map<string, number>(activeCounts);

  const sortedTiers = sortTiers(s.tiers);

  const nodes: ReferralMindmapNode[] = [];
  for (const id of limitedIds) {
    const profile = profileMap.get(id);
    if (!profile) continue;

    const firstName = (profile.firstName as string | undefined) ?? undefined;
    const lastName = (profile.lastName as string | undefined) ?? undefined;
    const email = (profile.email as string) ?? "";
    const displayName =
      firstName && firstName.length > 0
        ? `${firstName}${lastName ? ` ${lastName}` : ""}`.trim()
        : email || "Unknown";

    const activeCount = activeCountMap.get(id) ?? 0;
    const currentTier = findCurrentTier(activeCount, sortedTiers);
    const _nextTier = findCurrentTier(activeCount + 1, sortedTiers);
    const nextThreshold = sortedTiers.find((t) => t.threshold > activeCount);

    const node = graph.get(id);
    const parentIds = Array.from(node?.parents ?? []);
    const childIds = node?.children ?? new Set<string>();
    let totalSpend = 0;
    let totalTickets = 0;
    for (const e of edges) {
      if (e.source === id) {
        totalSpend += e.purchaseAmountGBP;
        totalTickets += e.ticketsAwarded;
      }
    }

    nodes.push({
      id,
      email,
      firstName,
      lastName,
      displayName,
      avatarUrl: profile.avatarUrl as string | undefined,
      country: profile.country as string | undefined,
      isVerified: !!(profile.isVerified as boolean),
      isAdmin: !!(profile.isAdmin as boolean),
      isGuestCheckout: !!(profile.isGuestCheckout as boolean),
      subscriptionStatus: (profile.subscriptionStatus as "active" | "cancelled" | "none") ?? "none",
      subscriptionTier: (profile.subscriptionTier as "25" | "50" | "100" | null) ?? null,
      createdAt: new Date(profile.createdAt as Date).toISOString(),
      totalSpent: Number(profile.totalSpent) || 0,
      totalEntries: Number(profile.totalEntries) || 0,
      winsCount: Number(profile.winsCount) || 0,
      referralCode: (profile.referralCode as string) ?? "",
      referralMultiplier: Number(profile.referralMultiplier) || 1,
      referralCount: Number(profile.referralCount) || 0,
      activeRefereeCount: activeCount,
      pendingRefereeCount: Math.max(0, (Number(profile.referralCount) || 0) - activeCount),
      ticketsMinted: totalTickets,
      totalReferralSpendGBP: totalSpend,
      referralWalletBalance: Number(profile.referralWalletBalance) || 0,
      referralWalletPending: Number(profile.referralWalletPending) || 0,
      lastAwardAt: profile.lastAwardAt
        ? new Date(profile.lastAwardAt as Date).toISOString()
        : undefined,
      currentTier: currentTier?.threshold ?? null,
      nextTier: nextThreshold?.threshold ?? null,
      referralsToNextTier: nextThreshold ? nextThreshold.threshold - activeCount : null,
      parentIds,
      depth: depthById.get(id) ?? 0,
      isRoot: rootIds.includes(id),
      hasChildren: childIds.size > 0,
      childCount: childIds.size,
    });
  }

  return {
    nodes,
    edges,
    meta: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      maxDepthReached: computedMaxDepth,
      truncated,
      settings: {
        activityWindowDays: s.activityWindowDays,
        activityWindowMode: s.activityWindowMode,
        monthlyCutoffDay: s.monthlyCutoffDay,
        minFirstOrderSpend: s.minFirstOrderSpend,
        tiers: sortedTiers,
      },
    },
  };
}

export async function getReferralMindmapForUser(
  userId: string,
  options: Omit<ReferralMindmapOptions, "rootUserId"> = {}
): Promise<ReferralMindmapResponse> {
  return getReferralMindmap({ ...options, rootUserId: userId });
}

import type { ReferralMindmapEdge, ReferralMindmapNode } from "@oc/api-referrals/mindmap";

export type EdgeKind = "referral_purchase" | "signup_only";

export interface EdgeContextParty {
  id: string;
  displayName: string;
  email: string;
}

export interface EdgeContext {
  edgeId: string;
  kind: EdgeKind;
  referrer: EdgeContextParty;
  referee: EdgeContextParty;
  purchasedAt: string | null;
  purchaseAmountGBP: number | null;
  ticketsAwarded: number;
  orderNumber: number | undefined;
  orderId: string | null;
  isActive: boolean;
  activityWindowDays: number;
  monthlyCutoffDay: number;
  edge: ReferralMindmapEdge;
}

const REFERRAL_PURCHASE: EdgeKind = "referral_purchase";
const SIGNUP_ONLY: EdgeKind = "signup_only";

function partyFromNode(
  node: ReferralMindmapNode | undefined,
  fallbackId: string
): EdgeContextParty {
  if (!node) {
    return { id: fallbackId, displayName: fallbackId, email: "" };
  }
  const displayName =
    node.displayName && node.displayName.length > 0 ? node.displayName : node.email;
  return { id: node.id, displayName, email: node.email };
}

export interface BuildEdgeContextOptions {
  activityWindowDays?: number;
  monthlyCutoffDay?: number;
}

export function buildEdgeContext(
  edge: ReferralMindmapEdge,
  nodeMap: Map<string, ReferralMindmapNode>,
  options: BuildEdgeContextOptions = {}
): EdgeContext {
  const kind: EdgeKind = edge.edgeKind === SIGNUP_ONLY ? SIGNUP_ONLY : REFERRAL_PURCHASE;
  const referrer = partyFromNode(nodeMap.get(edge.source), edge.source);
  const referee = partyFromNode(nodeMap.get(edge.target), edge.target);

  return {
    edgeId: edge.id,
    kind,
    referrer,
    referee,
    purchasedAt: edge.purchasedAt ?? null,
    purchaseAmountGBP: kind === REFERRAL_PURCHASE ? edge.purchaseAmountGBP : null,
    ticketsAwarded: kind === REFERRAL_PURCHASE ? (edge.ticketsAwarded ?? 0) : 0,
    orderNumber: edge.orderNumber,
    orderId: kind === REFERRAL_PURCHASE ? edge.orderId : null,
    isActive: edge.isActive,
    activityWindowDays: options.activityWindowDays ?? 30,
    monthlyCutoffDay: options.monthlyCutoffDay ?? 28,
    edge,
  };
}

export function formatEdgeWindowLabel(ctx: EdgeContext): string {
  const date = ctx.purchasedAt ? new Date(ctx.purchasedAt) : null;
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function edgeBadgeLabel(ctx: EdgeContext): {
  label: string;
  tone: "active" | "inactive" | "signup";
} {
  if (ctx.kind === "signup_only") return { label: "Signup only", tone: "signup" };
  if (ctx.isActive) return { label: "Active", tone: "active" };
  return { label: "Inactive", tone: "inactive" };
}

export function isReferralPurchaseEdge(edge: ReferralMindmapEdge): boolean {
  return edge.edgeKind !== SIGNUP_ONLY;
}

export function isSignupOnlyEdge(edge: ReferralMindmapEdge): boolean {
  return edge.edgeKind === SIGNUP_ONLY;
}

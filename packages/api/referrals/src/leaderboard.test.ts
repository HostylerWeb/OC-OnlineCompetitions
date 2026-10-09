import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  countUniqueActiveReferrers,
  getActiveReferrerDistribution,
  getReferrerUniqueActiveCount,
  getTopActiveReferrers,
} from "./leaderboard";

const state = vi.hoisted(() => ({
  settings: null as Record<string, unknown> | null,
  referralPurchases: [] as Array<Record<string, unknown>>,
  profiles: [] as Array<Record<string, unknown>>,
}));

vi.mock("@oc/api-db/models", () => ({
  ReferralSettings: {
    findById: vi.fn(() => ({
      lean: async () => state.settings,
    })),
  },
  ReferralPurchase: {
    aggregate: vi.fn(async (pipeline: Array<Record<string, unknown>>) => {
      return runPipeline(state.referralPurchases, pipeline, state.profiles);
    }),
  },
  Profile: {
    findById: vi.fn(),
    find: vi.fn(),
  },
}));

interface PurchaseDoc {
  _id: string;
  referrerId: string;
  referredUserId: string;
  purchasedAt: Date;
  purchaseAmount: number;
  deletedAt: Date | null;
  ticketsAwarded?: number;
}

interface ProfileDoc {
  _id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  createdAt: Date;
}

function runPipeline(
  purchases: Array<Record<string, unknown>>,
  pipeline: Array<Record<string, unknown>>,
  profiles: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  let rows: Array<Record<string, unknown>> = purchases.map((p) => ({
    ...p,
    purchasedAt: p.purchasedAt,
    purchaseAmount: p.purchaseAmount ?? 0,
    deletedAt: p.deletedAt ?? null,
    ticketsAwarded: p.ticketsAwarded ?? 0,
  }));

  const profileMap = new Map(profiles.map((p) => [p._id?.toString?.() ?? String(p._id), p]));

  for (const stage of pipeline) {
    const op = Object.keys(stage)[0];
    const args = (stage as Record<string, unknown>)[op];

    switch (op) {
      case "$match": {
        rows = rows.filter((r) => matchStage(r, args as Record<string, unknown>, profileMap));
        break;
      }
      case "$lookup": {
        const lookupArgs = args as {
          from: string;
          localField: string;
          foreignField: string;
          as: string;
          pipeline?: Array<Record<string, unknown>>;
        };
        rows = rows.map((r) => {
          const key = r[lookupArgs.localField]?.toString?.() ?? String(r[lookupArgs.localField]);
          const matches = profiles.filter((p) => {
            const pk =
              p[lookupArgs.foreignField]?.toString?.() ?? String(p[lookupArgs.foreignField]);
            return pk === key;
          });
          return { ...r, [lookupArgs.as]: matches };
        });
        break;
      }
      case "$unwind": {
        const path =
          typeof args === "string"
            ? args.replace(/^\$/, "")
            : (args as { path: string }).path.replace(/^\$/, "");
        const preserveNull =
          typeof args === "object" &&
          (args as { preserveNullAndEmptyArrays?: boolean }).preserveNullAndEmptyArrays;
        const out: Array<Record<string, unknown>> = [];
        for (const r of rows) {
          const arr = r[path] as Array<Record<string, unknown>> | undefined;
          if (!arr || arr.length === 0) {
            if (preserveNull) {
              out.push({ ...r, [path]: null });
            }
            continue;
          }
          for (const item of arr) {
            out.push({ ...r, [path]: item });
          }
        }
        rows = out;
        break;
      }
      case "$set": {
        const setArgs = args as Record<string, unknown>;
        rows = rows.map((r) => {
          const newR = { ...r };
          for (const [k, v] of Object.entries(setArgs)) {
            (newR as Record<string, unknown>)[k] = evaluateExpr(v, newR);
          }
          return newR;
        });
        break;
      }
      case "$addFields": {
        const afArgs = args as Record<string, unknown>;
        rows = rows.map((r) => {
          const newR = { ...r };
          for (const [k, v] of Object.entries(afArgs)) {
            (newR as Record<string, unknown>)[k] = evaluateExpr(v, newR);
          }
          return newR;
        });
        break;
      }
      case "$group": {
        const groupArgs = args as Record<string, unknown>;
        const grouped = new Map<string, Record<string, unknown>>();
        for (const r of rows) {
          const keyObj = evaluateExpr(groupArgs._id, r);
          const key = keyObj?.toString?.() ?? JSON.stringify(keyObj);
          if (!grouped.has(key)) {
            const acc = { _id: keyObj };
            for (const [k, v] of Object.entries(groupArgs)) {
              if (k === "_id") continue;
              const accOp = Object.keys(v as Record<string, unknown>)[0];
              (acc as Record<string, unknown>)[k] = initAcc(accOp);
            }
            grouped.set(key, acc);
          }
          const acc = grouped.get(key) as Record<string, unknown>;
          for (const [k, v] of Object.entries(groupArgs)) {
            if (k === "_id") continue;
            const accDef = v as Record<string, unknown>;
            const accOp = Object.keys(accDef)[0];
            const accArg = (accDef as Record<string, unknown>)[accOp];
            (acc as Record<string, unknown>)[k] = applyAcc(
              accOp,
              (acc as Record<string, unknown>)[k],
              evaluateExpr(accArg, r),
              r
            );
          }
        }
        rows = Array.from(grouped.values());
        break;
      }
      case "$sort": {
        const sortArgs = args as Record<string, 1 | -1>;
        rows = [...rows].sort((a, b) => {
          for (const [k, dir] of Object.entries(sortArgs)) {
            const av = (a as Record<string, unknown>)[k];
            const bv = (b as Record<string, unknown>)[k];
            if (av === bv) continue;
            if (av === undefined || av === null) return 1;
            if (bv === undefined || bv === null) return -1;
            if (av < bv) return -1 * dir;
            if (av > bv) return 1 * dir;
          }
          return 0;
        });
        break;
      }
      case "$limit": {
        rows = rows.slice(0, args as number);
        break;
      }
      case "$project": {
        const projectArgs = args as Record<string, unknown>;
        rows = rows.map((r) => {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(projectArgs)) {
            if (v === 1) {
              out[k] = r[k];
            } else if (typeof v === "string" && v.startsWith("$")) {
              out[k] = r[v.slice(1)];
            } else {
              out[k] = evaluateExpr(v, r);
            }
          }
          return out;
        });
        break;
      }
      case "$facet": {
        const facetArgs = args as Record<string, Array<Record<string, unknown>>>;
        const result: Record<string, unknown> = {};
        for (const [branchName, branchPipeline] of Object.entries(facetArgs)) {
          result[branchName] = runPipeline(rows, branchPipeline, profiles);
        }
        rows = [result];
        break;
      }
      case "$count": {
        rows = [{ n: rows.length }];
        break;
      }
      case "$bucket": {
        const bucketArgs = args as {
          groupBy: string;
          boundaries: number[];
          default: string;
          output: Record<string, unknown>;
        };
        const fieldKey = bucketArgs.groupBy.replace(/^\$/, "");
        const buckets = new Map<number | string, number>();
        for (const b of bucketArgs.boundaries) {
          buckets.set(b, 0);
        }
        buckets.set(bucketArgs.default, 0);
        for (const r of rows) {
          const v = (r as Record<string, unknown>)[fieldKey] as number;
          let matched: number | string = bucketArgs.default;
          for (let i = 0; i < bucketArgs.boundaries.length - 1; i++) {
            if (v >= bucketArgs.boundaries[i] && v < bucketArgs.boundaries[i + 1]) {
              matched = bucketArgs.boundaries[i + 1];
              break;
            }
          }
          buckets.set(matched, (buckets.get(matched) ?? 0) + 1);
        }
        rows = Array.from(buckets.entries())
          .filter(([_, count]) => count > 0 || typeof _ === "number")
          .map(([id, count]) => ({ _id: id, count }));
        break;
      }
      default:
        break;
    }
  }

  return rows;
}

function matchStage(
  row: Record<string, unknown>,
  filter: Record<string, unknown>,
  profileMap: Map<string, Record<string, unknown>>
): boolean {
  for (const [k, v] of Object.entries(filter)) {
    if (k === "$or") {
      const ors = v as Array<Record<string, unknown>>;
      if (!ors.some((sub) => matchStage(row, sub, profileMap))) return false;
      continue;
    }
    if (k === "deletedAt" && v === null) {
      if (row.deletedAt !== null && row.deletedAt !== undefined) return false;
      continue;
    }
    if (k === "referrerId" && v instanceof Object && "_bsontype" in (v as object)) {
      const rv = v as { toString(): string };
      const rowV = row.referrerId?.toString?.() ?? String(row.referrerId);
      if (rv.toString() !== rowV) return false;
      continue;
    }
    if (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      const opObj = v as Record<string, unknown>;
      const ops = Object.keys(opObj);
      if (ops.length === 1 && ops[0].startsWith("$")) {
        const op = ops[0];
        const operand = opObj[op];
        const rv = (row as Record<string, unknown>)[k];
        if (!applyMatchOp(op, rv, operand)) return false;
        continue;
      }
    }
    const rv = (row as Record<string, unknown>)[k];
    const rStr = rv?.toString?.() ?? rv;
    const vStr = (v as { toString?: () => string })?.toString?.() ?? v;
    if (rStr !== vStr) return false;
  }
  return true;
}

function applyMatchOp(op: string, rowVal: unknown, operand: unknown): boolean {
  switch (op) {
    case "$gt":
      return (rowVal as number) > (operand as number);
    case "$gte":
      return (rowVal as number) >= (operand as number);
    case "$lt":
      return (rowVal as number) < (operand as number);
    case "$lte":
      return (rowVal as number) <= (operand as number);
    case "$ne":
      return rowVal !== operand;
    case "$in": {
      const arr = operand as Array<unknown>;
      return arr.some(
        (x) =>
          (x as { toString?: () => string })?.toString?.() === rowVal?.toString?.() || x === rowVal
      );
    }
    case "$exists":
      return operand ? rowVal !== undefined : rowVal === undefined;
    default:
      return true;
  }
}

function initAcc(op: string): unknown {
  if (op === "$sum") return 0;
  if (op === "$addToSet") return [];
  if (op === "$max") return undefined;
  if (op === "$min") return undefined;
  if (op === "$first") return undefined;
  if (op === "$push") return [];
  return undefined;
}

function applyAcc(op: string, acc: unknown, val: unknown, _row: Record<string, unknown>): unknown {
  if (op === "$sum") {
    if (typeof val === "object" && val !== null && "$cond" in (val as object)) {
      const cond = val as { $cond: [Record<string, unknown>, unknown, unknown] };
      const result = evaluateExpr(cond.$cond[0], _row) ? cond.$cond[1] : cond.$cond[2];
      return (acc as number) + (typeof result === "number" ? result : 0);
    }
    if (typeof val === "number") return (acc as number) + val;
    return acc;
  }
  if (op === "$addToSet") {
    const arr = acc as unknown[];
    const key = val?.toString?.() ?? String(val);
    if (!arr.some((x) => (x?.toString?.() ?? String(x)) === key)) arr.push(val);
    return arr;
  }
  if (op === "$max") {
    if (val === undefined || val === null) return acc;
    if (acc === undefined || acc === null) return val;
    if (val > acc) return val;
    return acc;
  }
  if (op === "$min") {
    if (val === undefined || val === null) return acc;
    if (acc === undefined || acc === null) return val;
    if (val < acc) return val;
    return acc;
  }
  if (op === "$first") {
    if (acc === undefined) return val;
    return acc;
  }
  if (op === "$push") {
    (acc as unknown[]).push(val);
    return acc;
  }
  return val;
}

function resolveFieldPath(path: string, row: Record<string, unknown>): unknown {
  if (!path.startsWith("$")) return path;
  const parts = path.slice(1).split(".");
  let current: unknown = row;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function evaluateExpr(expr: unknown, row: Record<string, unknown>): unknown {
  if (expr === null || expr === undefined) return expr;
  if (typeof expr === "string") {
    return resolveFieldPath(expr, row);
  }
  if (typeof expr !== "object") return expr;
  const exprObj = expr as Record<string, unknown>;
  const op = Object.keys(exprObj)[0];
  if (!op.startsWith("$")) return expr;

  switch (op) {
    case "$cond": {
      const [condExpr, trueExpr, falseExpr] = exprObj.$cond as [
        Record<string, unknown>,
        unknown,
        unknown,
      ];
      return evaluateExpr(condExpr, row)
        ? evaluateExpr(trueExpr, row)
        : evaluateExpr(falseExpr, row);
    }
    case "$and": {
      return (exprObj.$and as Array<unknown>).every((sub) => evaluateExpr(sub, row));
    }
    case "$or": {
      return (exprObj.$or as Array<unknown>).some((sub) => evaluateExpr(sub, row));
    }
    case "$ne": {
      const [a, b] = exprObj.$ne as [unknown, unknown];
      const av = evaluateExpr(a, row);
      const bv = evaluateExpr(b, row);
      if (av === null && bv === null) return false;
      if (av === undefined && bv === undefined) return false;
      return av !== bv;
    }
    case "$lte": {
      const [a, b] = exprObj.$lte as [unknown, unknown];
      const av = evaluateExpr(a, row);
      const bv = evaluateExpr(b, row);
      const an = av instanceof Date ? av.getTime() : (av as number);
      const bn = bv instanceof Date ? bv.getTime() : (bv as number);
      return an <= bn;
    }
    case "$gte": {
      const [a, b] = exprObj.$gte as [unknown, unknown];
      const av = evaluateExpr(a, row);
      const bv = evaluateExpr(b, row);
      return av >= bv;
    }
    case "$ifNull": {
      const [a, b] = exprObj.$ifNull as [unknown, unknown];
      const av = evaluateExpr(a, row);
      return av !== null && av !== undefined ? av : evaluateExpr(b, row);
    }
    case "$size": {
      const v = exprObj.$size;
      const arr = typeof v === "string" ? resolveFieldPath(v, row) : v;
      return Array.isArray(arr) ? arr.length : 0;
    }
    case "$concat": {
      return (exprObj.$concat as Array<unknown>).map((p) => evaluateExpr(p, row) ?? "").join("");
    }
    case "$trim": {
      const inner = evaluateExpr(exprObj.$trim.input, row);
      return typeof inner === "string" ? inner.trim() : inner;
    }
    case "$addToSet":
    case "$sum":
    case "$first":
      return exprObj[op];
    case "$dateAdd": {
      const args = exprObj.$dateAdd as {
        startDate: string;
        unit: string;
        amount: number;
      };
      const startVal = resolveFieldPath(args.startDate, row);
      if (!(startVal instanceof Date)) return null;
      const start = startVal.getTime();
      const amount = args.amount;
      if (args.unit === "day") {
        return new Date(start + amount * 24 * 60 * 60 * 1000);
      }
      return new Date(start);
    }
    case "$arrayElemAt": {
      const [arrExpr, idxExpr] = exprObj.$arrayElemAt as [unknown, unknown];
      const arr = evaluateExpr(arrExpr, row);
      const idx = evaluateExpr(idxExpr, row) as number;
      return Array.isArray(arr) ? arr[idx] : undefined;
    }
    case "$toString":
      return String(evaluateExpr(exprObj.$toString, row));
    case "$count": {
      return "n";
    }
    case "$facet": {
      return evaluateExpr(exprObj.$facet, row);
    }
    default:
      return expr;
  }
}

function resetState() {
  state.settings = null;
  state.referralPurchases = [];
  state.profiles = [];
}

const REFERRER_A = "507f1f77bcf86cd799439001";
const REFERRER_B = "507f1f77bcf86cd799439002";
const REFERRER_C = "507f1f77bcf86cd799439003";
const REFERRED_X = "507f1f77bcf86cd799439011";
const REFERRED_Y = "507f1f77bcf86cd799439012";
const REFERRED_Z = "507f1f77bcf86cd799439013";

const SETTINGS = {
  activityWindowDays: 30,
  minFirstOrderSpend: 1,
};

function makePurchase(opts: {
  id: string;
  referrerId: string;
  referredUserId: string;
  daysAgo: number;
  amount: number;
  deleted?: boolean;
  ticketsAwarded?: number;
}): PurchaseDoc {
  const now = new Date();
  const purchasedAt = new Date(now.getTime() - opts.daysAgo * 24 * 60 * 60 * 1000);
  return {
    _id: opts.id,
    referrerId: opts.referrerId,
    referredUserId: opts.referredUserId,
    purchasedAt,
    purchaseAmount: opts.amount,
    deletedAt: opts.deleted ? new Date() : null,
    ticketsAwarded: opts.ticketsAwarded ?? 0,
  };
}

function makeProfile(opts: {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  daysOld: number;
}): ProfileDoc {
  const now = new Date();
  const createdAt = new Date(now.getTime() - opts.daysOld * 24 * 60 * 60 * 1000);
  return {
    _id: opts.id,
    firstName: opts.firstName,
    lastName: opts.lastName,
    email: opts.email,
    createdAt,
  };
}

beforeEach(() => {
  resetState();
  state.settings = SETTINGS;
  state.profiles = [
    makeProfile({
      id: REFERRER_A,
      firstName: "Alice",
      lastName: "Adams",
      email: "alice@test.com",
      daysOld: 90,
    }),
    makeProfile({ id: REFERRER_B, firstName: "Bob", email: "bob@test.com", daysOld: 90 }),
    makeProfile({ id: REFERRER_C, email: "carol@test.com", daysOld: 90 }),
    makeProfile({ id: REFERRED_X, email: "x@test.com", daysOld: 10 }),
    makeProfile({ id: REFERRED_Y, email: "y@test.com", daysOld: 10 }),
    makeProfile({ id: REFERRED_Z, email: "z@test.com", daysOld: 10 }),
  ];
});

describe("getTopActiveReferrers", () => {
  it("returns empty array when no purchases exist", async () => {
    const result = await getTopActiveReferrers({ limit: 10 });
    expect(result).toEqual([]);
  });

  it("excludes soft-deleted purchases by default", async () => {
    state.referralPurchases = [
      makePurchase({
        id: "p1",
        referrerId: REFERRER_A,
        referredUserId: REFERRED_X,
        daysAgo: 1,
        amount: 10,
      }),
      makePurchase({
        id: "p2",
        referrerId: REFERRER_A,
        referredUserId: REFERRED_Y,
        daysAgo: 1,
        amount: 10,
        deleted: true,
      }),
    ];
    const result = await getTopActiveReferrers({ limit: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(1);
  });

  it("includes soft-deleted purchases when includeDeleted=true", async () => {
    state.referralPurchases = [
      makePurchase({
        id: "p1",
        referrerId: REFERRER_A,
        referredUserId: REFERRED_X,
        daysAgo: 1,
        amount: 10,
      }),
      makePurchase({
        id: "p2",
        referrerId: REFERRER_A,
        referredUserId: REFERRED_Y,
        daysAgo: 1,
        amount: 10,
        deleted: true,
      }),
    ];
    const result = await getTopActiveReferrers({ limit: 10, includeDeleted: true });
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
  });

  it("deduplicates multiple qualifying purchases per (referrer, referred) pair", async () => {
    state.referralPurchases = [
      makePurchase({
        id: "p1",
        referrerId: REFERRER_A,
        referredUserId: REFERRED_X,
        daysAgo: 1,
        amount: 10,
      }),
      makePurchase({
        id: "p2",
        referrerId: REFERRER_A,
        referredUserId: REFERRED_X,
        daysAgo: 2,
        amount: 15,
      }),
      makePurchase({
        id: "p3",
        referrerId: REFERRER_A,
        referredUserId: REFERRED_Y,
        daysAgo: 1,
        amount: 10,
      }),
    ];
    const result = await getTopActiveReferrers({ limit: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
  });

  it("excludes purchases below minFirstOrderSpend", async () => {
    state.settings = { activityWindowDays: 30, minFirstOrderSpend: 100 };
    state.referralPurchases = [
      makePurchase({
        id: "p1",
        referrerId: REFERRER_A,
        referredUserId: REFERRED_X,
        daysAgo: 1,
        amount: 50,
      }),
    ];
    const result = await getTopActiveReferrers({ limit: 10 });
    expect(result).toEqual([]);
  });

  it("excludes purchases outside the activity window", async () => {
    state.profiles = [
      makeProfile({
        id: REFERRER_A,
        firstName: "Alice",
        lastName: "Adams",
        email: "alice@test.com",
        daysOld: 90,
      }),
      makeProfile({ id: REFERRED_X, email: "x@test.com", daysOld: 60 }),
    ];
    state.referralPurchases = [
      makePurchase({
        id: "p1",
        referrerId: REFERRER_A,
        referredUserId: REFERRED_X,
        daysAgo: 20,
        amount: 10,
      }),
    ];
    const result = await getTopActiveReferrers({ limit: 10 });
    expect(result).toEqual([]);
  });

  it("sorts by count DESC, then ticketsAwarded DESC", async () => {
    state.referralPurchases = [
      makePurchase({
        id: "p1",
        referrerId: REFERRER_A,
        referredUserId: REFERRED_X,
        daysAgo: 1,
        amount: 10,
        ticketsAwarded: 5,
      }),
      makePurchase({
        id: "p2",
        referrerId: REFERRER_B,
        referredUserId: REFERRED_X,
        daysAgo: 1,
        amount: 10,
        ticketsAwarded: 10,
      }),
      makePurchase({
        id: "p3",
        referrerId: REFERRER_B,
        referredUserId: REFERRED_Y,
        daysAgo: 1,
        amount: 10,
        ticketsAwarded: 10,
      }),
    ];
    const result = await getTopActiveReferrers({ limit: 10 });
    expect(result[0].referrerId).toBe(REFERRER_B);
    expect(result[0].count).toBe(2);
    expect(result[1].referrerId).toBe(REFERRER_A);
    expect(result[1].count).toBe(1);
  });

  it("respects the limit", async () => {
    state.referralPurchases = [
      makePurchase({
        id: "p1",
        referrerId: REFERRER_A,
        referredUserId: REFERRED_X,
        daysAgo: 1,
        amount: 10,
      }),
      makePurchase({
        id: "p2",
        referrerId: REFERRER_B,
        referredUserId: REFERRED_Y,
        daysAgo: 1,
        amount: 10,
      }),
      makePurchase({
        id: "p3",
        referrerId: REFERRER_C,
        referredUserId: REFERRED_Z,
        daysAgo: 1,
        amount: 10,
      }),
    ];
    const result = await getTopActiveReferrers({ limit: 2 });
    expect(result).toHaveLength(2);
  });

  it("builds the name from firstName + lastName with email fallback", async () => {
    state.referralPurchases = [
      makePurchase({
        id: "p1",
        referrerId: REFERRER_A,
        referredUserId: REFERRED_X,
        daysAgo: 1,
        amount: 10,
      }),
      makePurchase({
        id: "p2",
        referrerId: REFERRER_C,
        referredUserId: REFERRED_Y,
        daysAgo: 1,
        amount: 10,
      }),
    ];
    const result = await getTopActiveReferrers({ limit: 10 });
    const alice = result.find((r) => r.referrerId === REFERRER_A);
    expect(alice?.name).toBe("Alice Adams");
    const carol = result.find((r) => r.referrerId === REFERRER_C);
    expect(carol?.name).toBe("carol@test.com");
  });

  it("assigns sequential ranks starting at 1", async () => {
    state.referralPurchases = [
      makePurchase({
        id: "p1",
        referrerId: REFERRER_A,
        referredUserId: REFERRED_X,
        daysAgo: 1,
        amount: 10,
      }),
      makePurchase({
        id: "p2",
        referrerId: REFERRER_B,
        referredUserId: REFERRED_Y,
        daysAgo: 1,
        amount: 10,
      }),
      makePurchase({
        id: "p3",
        referrerId: REFERRER_C,
        referredUserId: REFERRED_Z,
        daysAgo: 1,
        amount: 10,
      }),
    ];
    const result = await getTopActiveReferrers({ limit: 10 });
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
});

describe("countUniqueActiveReferrers", () => {
  it("returns 0 when no qualifying purchases exist", async () => {
    const result = await countUniqueActiveReferrers();
    expect(result).toBe(0);
  });

  it("counts distinct referrers with at least one active purchase", async () => {
    state.referralPurchases = [
      makePurchase({
        id: "p1",
        referrerId: REFERRER_A,
        referredUserId: REFERRED_X,
        daysAgo: 1,
        amount: 10,
      }),
      makePurchase({
        id: "p2",
        referrerId: REFERRER_A,
        referredUserId: REFERRED_Y,
        daysAgo: 1,
        amount: 10,
      }),
      makePurchase({
        id: "p3",
        referrerId: REFERRER_B,
        referredUserId: REFERRED_Z,
        daysAgo: 1,
        amount: 10,
      }),
    ];
    const result = await countUniqueActiveReferrers();
    expect(result).toBe(2);
  });

  it("excludes soft-deleted purchases by default", async () => {
    state.referralPurchases = [
      makePurchase({
        id: "p1",
        referrerId: REFERRER_A,
        referredUserId: REFERRED_X,
        daysAgo: 1,
        amount: 10,
        deleted: true,
      }),
    ];
    const result = await countUniqueActiveReferrers();
    expect(result).toBe(0);
  });
});

describe("getReferrerUniqueActiveCount", () => {
  it("returns 0 when referrer has no qualifying purchases", async () => {
    const result = await getReferrerUniqueActiveCount(REFERRER_A);
    expect(result).toBe(0);
  });

  it("counts unique active referees for the given referrer", async () => {
    state.referralPurchases = [
      makePurchase({
        id: "p1",
        referrerId: REFERRER_A,
        referredUserId: REFERRED_X,
        daysAgo: 1,
        amount: 10,
      }),
      makePurchase({
        id: "p2",
        referrerId: REFERRER_A,
        referredUserId: REFERRED_X,
        daysAgo: 2,
        amount: 10,
      }),
      makePurchase({
        id: "p3",
        referrerId: REFERRER_A,
        referredUserId: REFERRED_Y,
        daysAgo: 1,
        amount: 10,
      }),
      makePurchase({
        id: "p4",
        referrerId: REFERRER_B,
        referredUserId: REFERRED_Z,
        daysAgo: 1,
        amount: 10,
      }),
    ];
    const result = await getReferrerUniqueActiveCount(REFERRER_A);
    expect(result).toBe(2);
  });
});

describe("getActiveReferrerDistribution", () => {
  it("buckets referrers by their unique active count", async () => {
    state.referralPurchases = [
      makePurchase({
        id: "p1",
        referrerId: REFERRER_A,
        referredUserId: REFERRED_X,
        daysAgo: 1,
        amount: 10,
      }),
      makePurchase({
        id: "p2",
        referrerId: REFERRER_B,
        referredUserId: REFERRED_X,
        daysAgo: 1,
        amount: 10,
      }),
      makePurchase({
        id: "p3",
        referrerId: REFERRER_B,
        referredUserId: REFERRED_Y,
        daysAgo: 1,
        amount: 10,
      }),
      makePurchase({
        id: "p4",
        referrerId: REFERRER_C,
        referredUserId: REFERRED_X,
        daysAgo: 1,
        amount: 10,
      }),
      makePurchase({
        id: "p5",
        referrerId: REFERRER_C,
        referredUserId: REFERRED_Y,
        daysAgo: 1,
        amount: 10,
      }),
      makePurchase({
        id: "p6",
        referrerId: REFERRER_C,
        referredUserId: REFERRED_Z,
        daysAgo: 1,
        amount: 10,
      }),
    ];
    const result = await getActiveReferrerDistribution([2, 5]);
    const totalReferrers = result.buckets.reduce((s, b) => s + b.count, 0);
    expect(totalReferrers).toBeGreaterThan(0);
  });

  it("returns empty buckets when no purchases exist", async () => {
    const result = await getActiveReferrerDistribution([5, 10]);
    const total = result.buckets.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(0);
  });
});

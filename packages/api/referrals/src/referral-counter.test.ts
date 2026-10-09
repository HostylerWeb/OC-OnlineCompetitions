import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  reconcileReferralCount,
  reconcileReferralCountOnDelete,
  reconcileReferralCountOnReassign,
  reconcileReferralCountOnRestore,
} from "./referral-counter";

const state = vi.hoisted(() => ({
  profiles: new Map<string, { _id: string; referralCount?: number }>(),
  referralPurchases: [] as Array<{
    _id: string;
    referrerId: string;
    referredUserId: string;
    deletedAt: Date | null;
  }>,
  invalidateCalls: [] as string[],
}));

vi.mock("@oc/api-infra/cache", () => ({
  invalidateUser: vi.fn(async (id: string) => {
    state.invalidateCalls.push(id);
  }),
}));

vi.mock("@oc/api-db/models", () => ({
  Profile: {
    findById: vi.fn((id: unknown) => ({
      select: () => ({
        lean: async () => state.profiles.get(String(id)) ?? null,
      }),
      lean: async () => state.profiles.get(String(id)) ?? null,
    })),
    findByIdAndUpdate: vi.fn(async (id: unknown, update: Record<string, unknown>) => {
      const profile = state.profiles.get(String(id));
      if (!profile) return null;
      if (update.$set) {
        Object.assign(profile, update.$set);
      }
      return profile;
    }),
    updateOne: vi.fn(async () => ({})),
    find: vi.fn(),
  },
  ReferralPurchase: {
    aggregate: vi.fn(async (pipeline: Array<Record<string, unknown>>) => {
      return runMockPipeline(state.referralPurchases, pipeline);
    }),
    countDocuments: vi.fn(async () => 0),
  },
}));

function runMockPipeline(
  purchases: Array<{
    _id: string;
    referrerId: string;
    referredUserId: string;
    deletedAt: Date | null;
  }>,
  pipeline: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  let rows: Array<Record<string, unknown>> = purchases.map((p) => ({ ...p }));

  for (const stage of pipeline) {
    const op = Object.keys(stage)[0];
    const args = (stage as Record<string, unknown>)[op];

    if (op === "$match") {
      const filter = args as Record<string, unknown>;
      rows = rows.filter((r) => {
        for (const [k, v] of Object.entries(filter)) {
          if (k === "deletedAt" && v === null && r.deletedAt !== null) return false;
          if (k === "referrerId") {
            const expected = v as { toString?: () => string };
            const actual = r.referrerId as string;
            if (expected?.toString?.() !== actual) return false;
          }
          if (k === "referredUserId") {
            const expected = v as { toString?: () => string };
            const actual = r.referredUserId as string;
            if (expected?.toString?.() !== actual) return false;
          }
        }
        return true;
      });
    }

    if (op === "$group") {
      const groupArgs = args as Record<string, unknown>;
      const grouped = new Map<string, Record<string, unknown>>();
      for (const r of rows) {
        const keyExpr = groupArgs._id;
        let key: string;
        if (
          typeof keyExpr === "object" &&
          keyExpr !== null &&
          "referrerId" in (keyExpr as object)
        ) {
          const refs = keyExpr as { referrerId: string; referredUserId: string };
          key = `${r[refs.referrerId.slice(1)]}_${r[refs.referredUserId.slice(1)]}`;
        } else {
          key = String(r[String(keyExpr).slice(1)]);
        }
        if (!grouped.has(key)) {
          grouped.set(key, { _id: key });
        }
      }
      rows = Array.from(grouped.values());
    }

    if (op === "$count") {
      return [{ n: rows.length }];
    }
  }

  return rows;
}

function resetState(): void {
  state.profiles = new Map();
  state.referralPurchases = [];
  state.invalidateCalls = [];
}

const REFERRER_A = "507f1f77bcf86cd799439001";
const REFERRER_B = "507f1f77bcf86cd799439002";
const REFERRED_X = "507f1f77bcf86cd799439011";
const REFERRED_Y = "507f1f77bcf86cd799439012";

afterEach(() => {
  resetState();
});

describe("reconcileReferralCountOnDelete", () => {
  beforeEach(() => {
    resetState();
  });

  it("recomputes referralCount from live active pairs", async () => {
    state.profiles.set(REFERRER_A, { _id: REFERRER_A, referralCount: 5 });
    state.referralPurchases = [
      { _id: "p1", referrerId: REFERRER_A, referredUserId: REFERRED_X, deletedAt: null },
      { _id: "p2", referrerId: REFERRER_A, referredUserId: REFERRED_Y, deletedAt: null },
    ];
    await reconcileReferralCountOnDelete(REFERRER_A, REFERRED_X);
    expect(state.profiles.get(REFERRER_A)?.referralCount).toBe(2);
  });

  it("writes 0 when no active pairs remain", async () => {
    state.profiles.set(REFERRER_A, { _id: REFERRER_A, referralCount: 5 });
    state.referralPurchases = [
      { _id: "p1", referrerId: REFERRER_A, referredUserId: REFERRED_X, deletedAt: new Date() },
    ];
    await reconcileReferralCountOnDelete(REFERRER_A, REFERRED_X);
    expect(state.profiles.get(REFERRER_A)?.referralCount).toBe(0);
  });

  it("invalidates user cache on change", async () => {
    state.profiles.set(REFERRER_A, { _id: REFERRER_A, referralCount: 5 });
    state.referralPurchases = [];
    await reconcileReferralCountOnDelete(REFERRER_A, REFERRED_X);
    expect(state.invalidateCalls).toContain(REFERRER_A);
  });
});

describe("reconcileReferralCountOnRestore", () => {
  beforeEach(() => {
    resetState();
  });

  it("recomputes referralCount from live active pairs after restore", async () => {
    state.profiles.set(REFERRER_A, { _id: REFERRER_A, referralCount: 0 });
    state.referralPurchases = [
      { _id: "p1", referrerId: REFERRER_A, referredUserId: REFERRED_X, deletedAt: null },
    ];
    await reconcileReferralCountOnRestore(REFERRER_A, REFERRED_X);
    expect(state.profiles.get(REFERRER_A)?.referralCount).toBe(1);
  });

  it("no-ops when stored count already matches live", async () => {
    state.profiles.set(REFERRER_A, { _id: REFERRER_A, referralCount: 2 });
    state.referralPurchases = [
      { _id: "p1", referrerId: REFERRER_A, referredUserId: REFERRED_X, deletedAt: null },
      { _id: "p2", referrerId: REFERRER_A, referredUserId: REFERRED_Y, deletedAt: null },
    ];
    await reconcileReferralCountOnRestore(REFERRER_A, REFERRED_X);
    expect(state.profiles.get(REFERRER_A)?.referralCount).toBe(2);
    expect(state.invalidateCalls).not.toContain(REFERRER_A);
  });
});

describe("reconcileReferralCountOnReassign", () => {
  beforeEach(() => {
    resetState();
  });

  it("updates both old and new referrer counts", async () => {
    state.profiles.set(REFERRER_A, { _id: REFERRER_A, referralCount: 5 });
    state.profiles.set(REFERRER_B, { _id: REFERRER_B, referralCount: 3 });
    state.referralPurchases = [
      { _id: "p1", referrerId: REFERRER_B, referredUserId: REFERRED_X, deletedAt: null },
      { _id: "p2", referrerId: REFERRER_B, referredUserId: REFERRED_Y, deletedAt: null },
    ];
    await reconcileReferralCountOnReassign({
      userId: REFERRED_X,
      oldReferrerId: REFERRER_A,
      newReferrerId: REFERRER_B,
    });
    expect(state.profiles.get(REFERRER_A)?.referralCount).toBe(0);
    expect(state.profiles.get(REFERRER_B)?.referralCount).toBe(2);
  });

  it("updates only old referrer when new is null (clear)", async () => {
    state.profiles.set(REFERRER_A, { _id: REFERRER_A, referralCount: 5 });
    state.referralPurchases = [
      { _id: "p1", referrerId: REFERRER_A, referredUserId: REFERRED_X, deletedAt: null },
      { _id: "p2", referrerId: REFERRER_A, referredUserId: REFERRED_Y, deletedAt: null },
    ];
    await reconcileReferralCountOnReassign({
      userId: REFERRED_X,
      oldReferrerId: REFERRER_A,
      newReferrerId: null,
    });
    expect(state.profiles.get(REFERRER_A)?.referralCount).toBe(2);
  });

  it("updates only new referrer when old is null (set first time)", async () => {
    state.profiles.set(REFERRER_B, { _id: REFERRER_B, referralCount: 0 });
    state.referralPurchases = [
      { _id: "p1", referrerId: REFERRER_B, referredUserId: REFERRED_X, deletedAt: null },
    ];
    await reconcileReferralCountOnReassign({
      userId: REFERRED_X,
      oldReferrerId: null,
      newReferrerId: REFERRER_B,
    });
    expect(state.profiles.get(REFERRER_B)?.referralCount).toBe(1);
  });

  it("no-ops when old and new referrer are the same", async () => {
    state.profiles.set(REFERRER_A, { _id: REFERRER_A, referralCount: 5 });
    state.referralPurchases = [
      { _id: "p1", referrerId: REFERRER_A, referredUserId: REFERRED_X, deletedAt: null },
    ];
    await reconcileReferralCountOnReassign({
      userId: REFERRED_X,
      oldReferrerId: REFERRER_A,
      newReferrerId: REFERRER_A,
    });
    expect(state.profiles.get(REFERRER_A)?.referralCount).toBe(5);
    expect(state.invalidateCalls).not.toContain(REFERRER_A);
  });
});

describe("reconcileReferralCount", () => {
  beforeEach(() => {
    resetState();
  });

  it("no-ops when stored count matches live count", async () => {
    state.profiles.set(REFERRER_A, { _id: REFERRER_A, referralCount: 2 });
    state.referralPurchases = [
      { _id: "p1", referrerId: REFERRER_A, referredUserId: REFERRED_X, deletedAt: null },
      { _id: "p2", referrerId: REFERRER_A, referredUserId: REFERRED_Y, deletedAt: null },
    ];
    await reconcileReferralCount(REFERRER_A);
    expect(state.profiles.get(REFERRER_A)?.referralCount).toBe(2);
  });

  it("fixes drifted count", async () => {
    state.profiles.set(REFERRER_A, { _id: REFERRER_A, referralCount: 5 });
    state.referralPurchases = [
      { _id: "p1", referrerId: REFERRER_A, referredUserId: REFERRED_X, deletedAt: null },
      { _id: "p2", referrerId: REFERRER_A, referredUserId: REFERRED_Y, deletedAt: null },
    ];
    await reconcileReferralCount(REFERRER_A);
    expect(state.profiles.get(REFERRER_A)?.referralCount).toBe(2);
  });
});

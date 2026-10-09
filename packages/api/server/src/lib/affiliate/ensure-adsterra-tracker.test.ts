import { beforeEach, describe, expect, test, vi } from "vitest";

const mockFindOne = vi.fn();
const mockFindOneAndUpdate = vi.fn();
const mockInvalidate = vi.fn(async () => {});

vi.mock("@oc/api-db/models", () => ({
  ConversionSettings: {
    findOne: (...args: unknown[]) => ({
      lean: () => mockFindOne(...args),
    }),
    findOneAndUpdate: (...args: unknown[]) => mockFindOneAndUpdate(...args),
  },
}));

vi.mock("@oc/api-infra/cache", () => ({
  CH: { conversionSettings: "settings.conversion_settings" },
  invalidateByChannelSafe: (...args: unknown[]) => mockInvalidate(...args),
}));

import { ensureAdsterraTracker } from "./ensure-adsterra-tracker";

const DEFAULT_URL =
  "https://www.pbterra.com/code/GBP/onlinecompetitions/at?subid_short={clickid}&atpay={payout}";

const ADSTERRA_TRACKER = {
  id: "adsterra",
  name: "Adsterra",
  enabled: false,
  events: {
    purchase: {
      enabled: false,
      method: "GET",
      urlTemplate: DEFAULT_URL,
      payoutOverride: null,
    },
  },
};

describe("ensureAdsterraTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("seeds a fresh settings doc with a disabled adsterra tracker", async () => {
    mockFindOne.mockResolvedValue(null);

    await ensureAdsterraTracker();

    expect(mockFindOne).toHaveBeenCalledWith({ _id: "conversion_settings" });
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "conversion_settings" },
      {
        $set: {
          trackers: [ADSTERRA_TRACKER],
          enabled: false,
          defaultPayouts: { signup: 0, purchase: 0 },
        },
      },
      { upsert: true }
    );
    expect(mockInvalidate).toHaveBeenCalledWith("settings.conversion_settings");
  });

  test("does not clobber an existing adsterra tracker (admin edits preserved)", async () => {
    const adminTracker = {
      id: "adsterra",
      name: "Adsterra",
      enabled: true,
      events: {
        purchase: {
          enabled: true,
          method: "GET",
          urlTemplate: "https://custom.example/conv?subid_short={clickid}&atpay={payout}",
          payoutOverride: 42,
        },
      },
    };
    mockFindOne.mockResolvedValue({
      _id: "conversion_settings",
      enabled: true,
      trackers: [adminTracker],
    });

    await ensureAdsterraTracker();

    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
  });

  test("preserves existing trackers and master toggle when appending", async () => {
    const existingTrackers = [
      {
        id: "some-other-tracker",
        name: "Other",
        enabled: true,
        events: {
          purchase: { enabled: true, urlTemplate: "https://x/{clickid}", method: "GET" },
        },
      },
    ];
    mockFindOne.mockResolvedValue({
      _id: "conversion_settings",
      enabled: true,
      trackers: existingTrackers,
    });

    await ensureAdsterraTracker();

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "conversion_settings" },
      {
        $set: {
          trackers: [existingTrackers[0], ADSTERRA_TRACKER],
        },
      },
      { upsert: true }
    );
    const update = mockFindOneAndUpdate.mock.calls[0][1] as {
      $set?: Record<string, unknown>;
    };
    expect(update.$set).not.toHaveProperty("enabled");
    expect(update.$set).not.toHaveProperty("defaultPayouts");
  });

  test("is idempotent across repeated bootstrap runs", async () => {
    mockFindOne.mockResolvedValue({
      _id: "conversion_settings",
      enabled: false,
      trackers: [ADSTERRA_TRACKER],
    });

    await ensureAdsterraTracker();
    await ensureAdsterraTracker();

    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
  });
});

import { describe, expect, test } from "vitest";
import { walletBalanceToBand } from "./wallet-band";

describe("walletBalanceToBand", () => {
  test("maps amounts to bands", () => {
    expect(walletBalanceToBand(0)).toBe("zero");
    expect(walletBalanceToBand(5)).toBe("low");
    expect(walletBalanceToBand(25)).toBe("medium");
    expect(walletBalanceToBand(100)).toBe("high");
  });
});

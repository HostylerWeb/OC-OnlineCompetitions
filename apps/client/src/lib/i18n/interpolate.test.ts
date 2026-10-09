import { describe, expect, test } from "vitest";
import { interpolate } from "./interpolate";

describe("interpolate - English plural", () => {
  test("singular (1)", () => {
    expect(interpolate("You own {count} ticket{plural}", { count: 1 }, "en")).toBe(
      "You own 1 ticket"
    );
  });

  test("plural (2)", () => {
    expect(interpolate("You own {count} ticket{plural}", { count: 2 }, "en")).toBe(
      "You own 2 tickets"
    );
  });

  test("zero is plural", () => {
    expect(interpolate("You won {count} prize{plural}", { count: 0 }, "en")).toBe(
      "You won 0 prizes"
    );
  });

  test("20 is plural", () => {
    expect(interpolate("{count} ticket{plural} to go", { count: 20 }, "en")).toBe(
      "20 tickets to go"
    );
  });

  test("formatted thousands string is parsed (1,000)", () => {
    expect(interpolate("You own {count} ticket{plural}", { count: "1,000" }, "en")).toBe(
      "You own 1,000 tickets"
    );
  });

  test("missing plural driver leaves the token literal (old bug)", () => {
    expect(
      interpolate("You already own {owned} ticket{plural} you can purchase {more} more", {
        owned: 13,
        more: 1000,
      })
    ).toBe("You already own 13 ticket{plural} you can purchase 1000 more");
  });

  test("missing generic token stays literal", () => {
    expect(interpolate("Hello {name}", {}, "en")).toBe("Hello {name}");
  });
});

describe("interpolate - Romanian plural", () => {
  test("bilet: one vs many", () => {
    expect(interpolate("Ai deja {count} bilet{plural}", { count: 1 }, "ro")).toBe(
      "Ai deja 1 bilet"
    );
    expect(interpolate("Ai deja {count} bilet{plural}", { count: 5 }, "ro")).toBe(
      "Ai deja 5 bilete"
    );
    expect(interpolate("Ai deja {count} bilet{plural}", { count: 20 }, "ro")).toBe(
      "Ai deja 20 bilete"
    );
  });

  test("premiu -> premii (vowel-dropping word)", () => {
    expect(interpolate("Ai câștigat {count} premiu{plural}", { count: 2 }, "ro")).toBe(
      "Ai câștigat 2 premii"
    );
  });

  test("etapă -> etape and atinsă -> atinse (stem-changing words)", () => {
    expect(interpolate("{count} etapă{plural} atinsă{plural}", { count: 3 }, "ro")).toBe(
      "3 etape atinse"
    );
    expect(interpolate("{count} etapă{plural} atinsă{plural}", { count: 1 }, "ro")).toBe(
      "1 etapă atinsă"
    );
  });

  test("rămas -> rămase (feminine plural)", () => {
    expect(interpolate("{count} bilet{plural} rămas{plural}", { count: 7 }, "ro")).toBe(
      "7 bilete rămase"
    );
  });

  test("câștig -> câștiguri", () => {
    expect(interpolate("{count} câștig{plural}", { count: 4 }, "ro")).toBe("4 câștiguri");
  });

  test("extragere -> extrageri (bonus draws pill)", () => {
    expect(interpolate("+{count} extragere{plural} bonus", { count: 1 }, "ro")).toBe(
      "+1 extragere bonus"
    );
    expect(interpolate("+{count} extragere{plural} bonus", { count: 5 }, "ro")).toBe(
      "+5 extrageri bonus"
    );
  });

  test("răscumpărat is pluralized even when not in old suffix map", () => {
    expect(interpolate("{count} bilet{plural} răscumpărat{plural}", { count: 2 }, "ro")).toBe(
      "2 bilete răscumpărate"
    );
  });

  test("formatted ro-RO dot separator is parsed as thousands (1.000)", () => {
    expect(interpolate("Ai deja {count} bilet{plural}", { count: "1.000" }, "ro")).toBe(
      "Ai deja 1.000 bilete"
    );
  });
});

describe("interpolate - general tokens", () => {
  test("substitutes all generic tokens", () => {
    expect(
      interpolate("Cart will update from {from} to {to} ticket{plural}", {
        count: 3,
        from: "1",
        to: "3",
      })
    ).toBe("Cart will update from 1 to 3 tickets");
  });
});

import { describe, expect, test } from "vitest";
import type { OpenRouterModelListItem } from "@oc/types";
import { compareOpenRouterModelsForDisplay, isOpenRouterFreeModel } from "./list-models";

function model(overrides: Partial<OpenRouterModelListItem> & { id: string }): OpenRouterModelListItem {
  return {
    name: overrides.name ?? overrides.id,
    isFree: overrides.isFree ?? false,
    promptPricePerToken: overrides.promptPricePerToken ?? 0,
    completionPricePerToken: overrides.completionPricePerToken ?? 0,
    contextLength: overrides.contextLength ?? null,
    ...overrides,
  };
}

describe("isOpenRouterFreeModel", () => {
  test("treats zero pricing as free", () => {
    expect(
      isOpenRouterFreeModel({
        id: "vendor/model",
        pricing: { prompt: "0", completion: "0" },
      })
    ).toBe(true);
  });

  test("treats :free suffix as free", () => {
    expect(
      isOpenRouterFreeModel({
        id: "vendor/model:free",
        pricing: { prompt: "0.00001", completion: "0" },
      })
    ).toBe(true);
  });

  test("treats paid pricing as paid", () => {
    expect(
      isOpenRouterFreeModel({
        id: "vendor/model",
        pricing: { prompt: "0.000001", completion: "0.000002" },
      })
    ).toBe(false);
  });
});

describe("compareOpenRouterModelsForDisplay", () => {
  test("sorts paid models most expensive first by combined input+output", () => {
    const cheap = model({
      id: "cheap",
      promptPricePerToken: 1,
      completionPricePerToken: 1,
    });
    const pricey = model({
      id: "pricey",
      promptPricePerToken: 5,
      completionPricePerToken: 10,
    });
    expect(compareOpenRouterModelsForDisplay("paid", pricey, cheap)).toBeLessThan(0);
    expect(compareOpenRouterModelsForDisplay("paid", cheap, pricey)).toBeGreaterThan(0);
  });

  test("sorts free models alphabetically by name", () => {
    const a = model({ id: "a", name: "Alpha", isFree: true });
    const b = model({ id: "b", name: "Beta", isFree: true });
    expect(compareOpenRouterModelsForDisplay("free", a, b)).toBeLessThan(0);
  });
});

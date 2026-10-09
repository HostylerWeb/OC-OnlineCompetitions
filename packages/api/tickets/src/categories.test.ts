import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const updateManyCalls = { value: [] as Array<[Record<string, unknown>, Record<string, unknown>]> };

vi.mock("@oc/api-db/models", () => ({
  Competition: {
    updateMany: vi.fn(async (filter: Record<string, unknown>, update: Record<string, unknown>) => {
      updateManyCalls.value.push([filter, update]);
      return { modifiedCount: 1 };
    }),
  },
}));

describe("category backpropagation", () => {
  beforeEach(() => {
    updateManyCalls.value = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function loadCategoriesLib() {
    return import("@oc/api-tickets/categories");
  }

  test("backpropagateCategorySlugChange updates competitions with old slug", async () => {
    const { backpropagateCategorySlugChange } = await loadCategoriesLib();

    const modifiedCount = await backpropagateCategorySlugChange("cars", "vehicles");

    expect(modifiedCount).toBe(1);
    expect(updateManyCalls.value).toEqual([
      [{ category: "cars" }, { $set: { category: "vehicles" } }],
    ]);
  });

  test("backpropagateCategorySlugChange is a no-op when slug is unchanged", async () => {
    const { backpropagateCategorySlugChange } = await loadCategoriesLib();

    const modifiedCount = await backpropagateCategorySlugChange("cars", "cars");

    expect(modifiedCount).toBe(0);
    expect(updateManyCalls.value).toEqual([]);
  });

  test("clearCategoryFromCompetitions unsets category on matching competitions", async () => {
    const { clearCategoryFromCompetitions } = await loadCategoriesLib();

    const modifiedCount = await clearCategoryFromCompetitions("cars");

    expect(modifiedCount).toBe(1);
    expect(updateManyCalls.value).toEqual([[{ category: "cars" }, { $unset: { category: "" } }]]);
  });
});

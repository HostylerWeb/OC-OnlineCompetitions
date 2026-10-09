import { Competition } from "@oc/api-db/models";

/** Update competitions that store the old category slug after a rename. */
export async function backpropagateCategorySlugChange(
  oldSlug: string,
  newSlug: string
): Promise<number> {
  if (!oldSlug || !newSlug || oldSlug === newSlug) {
    return 0;
  }

  const result = await Competition.updateMany(
    { category: oldSlug },
    { $set: { category: newSlug } }
  );

  return result.modifiedCount;
}

/** Clear denormalized category slug from competitions when a category is deleted. */
export async function clearCategoryFromCompetitions(slug: string): Promise<number> {
  if (!slug) {
    return 0;
  }

  const result = await Competition.updateMany({ category: slug }, { $unset: { category: "" } });

  return result.modifiedCount;
}

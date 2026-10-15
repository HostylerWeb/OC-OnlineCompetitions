import type { CompetitionFormState, CompetitionImage } from "./types";

const PRIMARY_ROLE = "primary" as const;

/** Adds a generated asset URL to the pool and marks it as the primary image. */
export function addGeneratedImageToPool(
  prev: CompetitionFormState,
  url: string
): CompetitionFormState {
  const withoutPrimary = prev.images.map((img) => ({
    ...img,
    roles: img.roles.filter((r) => r !== PRIMARY_ROLE),
  }));
  const existing = withoutPrimary.find((i) => i.url === url);
  if (existing) {
    return {
      ...prev,
      images: withoutPrimary.map((img) =>
        img.url === url
          ? { ...img, roles: [...new Set([...img.roles, PRIMARY_ROLE])] }
          : img
      ),
    };
  }
  return {
    ...prev,
    images: [...withoutPrimary, { url, roles: [PRIMARY_ROLE] } satisfies CompetitionImage],
  };
}

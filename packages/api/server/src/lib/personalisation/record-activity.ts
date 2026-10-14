import { UserActivityDay } from "@oc/api-db/models";

function utcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export async function touchUserActivity(userId: string, categorySlug?: string): Promise<void> {
  const day = utcDayKey();
  const update: Record<string, unknown> = {
    $set: { lastSeenAt: new Date() },
    $setOnInsert: { userId, day },
  };
  if (categorySlug?.trim()) {
    update.$addToSet = { categorySlugs: categorySlug.trim() };
  }
  await UserActivityDay.updateOne({ userId, day }, update, { upsert: true });
}

export function scheduleTouchUserActivity(userId: string, categorySlug?: string): void {
  void touchUserActivity(userId, categorySlug).catch((err) => {
    console.warn("[personalisation] touchUserActivity failed", { userId, err });
  });
}

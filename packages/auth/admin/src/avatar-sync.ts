import { dbConnect } from "@oc/api-db";
import { Profile } from "@oc/api-db/models";
import { invalidateUser } from "@oc/api-infra/cache";

export async function maybeSyncAvatarFromAuthUser(
  userId: string,
  image?: string | null
): Promise<void> {
  if (!image) return;

  await dbConnect();

  const profile = await Profile.findById(userId).select("avatarUrl").lean();
  if (profile?.avatarUrl) return;

  await Profile.findByIdAndUpdate(userId, { avatarUrl: image });
  void invalidateUser(userId).catch(() => {});
}

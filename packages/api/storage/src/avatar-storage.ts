import { getMongoDb } from "@oc/auth-admin/auth-mongo";
import { deleteAsset, extractKeyFromUrl, getAssetBaseUrl } from "./s3";

export async function deleteAvatarIfOwned(url: string | undefined | null): Promise<void> {
  if (!url) return;

  const prefix = `${getAssetBaseUrl()}/`;
  if (!url.startsWith(prefix)) return;

  const key = extractKeyFromUrl(url);
  if (!key.startsWith("avatars/")) return;

  try {
    await deleteAsset(key);
  } catch (err: unknown) {
    console.error("Failed to delete avatar asset:", key, err);
  }
}

export async function getAuthUserImage(userId: string): Promise<string | null | undefined> {
  const db = getMongoDb();
  const user = await db.collection("user").findOne({ id: userId }, { projection: { image: 1 } });
  return user?.image as string | null | undefined;
}

export async function hasGoogleAccount(userId: string): Promise<boolean> {
  const db = getMongoDb();
  const account = await db.collection("account").findOne({ userId, providerId: "google" });
  return Boolean(account);
}

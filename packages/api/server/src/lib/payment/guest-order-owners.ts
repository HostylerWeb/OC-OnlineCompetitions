import { canonicalizeEmail } from "@oc/auth-admin/auth-hooks";
import { Profile } from "@oc/api-db/models";
import { Types } from "mongoose";

const GUEST_EMAIL_SUFFIX = "@guest.onlinecompetitions.local";

export interface OrderReadScope {
  userIds: string[];
  emails: string[];
}

/** Anonymous sessions resolve guest-checkout orders via the checkout email. */
export async function resolveOrderReadScope(sessionUserId: string): Promise<OrderReadScope> {
  const userIds = [sessionUserId];
  const emails: string[] = [];

  const profile = await Profile.findById(sessionUserId).select("email").lean();
  const email = profile?.email;

  if (email && !email.endsWith(GUEST_EMAIL_SUFFIX)) {
    const canonical = canonicalizeEmail(email);
    if (canonical) emails.push(canonical);

    const sameEmailProfiles = await Profile.find({
      email: canonical,
      _id: { $ne: new Types.ObjectId(sessionUserId) },
    })
      .select("_id")
      .lean();

    for (const p of sameEmailProfiles) {
      const id = p._id.toString();
      if (!userIds.includes(id)) userIds.push(id);
    }
  }

  return { userIds, emails };
}
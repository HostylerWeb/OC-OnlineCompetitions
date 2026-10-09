import { dbConnect } from "@oc/api-db";
import { EmailSettings, type IEmailSettings } from "@oc/api-db/models";
import { DEFAULT_SOCIAL_URLS } from "@oc/utils";
import { BRAND_NAME, LEGAL_CONTACT_EMAIL } from "@oc/utils";

let _cache: IEmailSettings | null = null;
let _cacheExpiry = 0;
const CACHE_TTL_MS = 60_000;

export type { IEmailSettings };

const DEFAULTS: Omit<IEmailSettings, "siteUrl"> & { siteUrl?: never } = {
  _id: "email_settings",
  fromName: BRAND_NAME,
  fromEmail: LEGAL_CONTACT_EMAIL,
  supportAddress: LEGAL_CONTACT_EMAIL,
  social: { ...DEFAULT_SOCIAL_URLS },
  updatedAt: new Date(),
};

export async function getEmailConfig(): Promise<IEmailSettings> {
  const now = Date.now();
  if (_cache && now < _cacheExpiry) return _cache;

  try {
    await dbConnect();

    const model = EmailSettings as any;
    const doc = await model.findOne({ _id: "email_settings" }).lean();
    if (doc) {
      _cache = doc as IEmailSettings;
    } else {
      _cache = DEFAULTS;
    }
  } catch {
    _cache = DEFAULTS;
  }

  _cacheExpiry = now + CACHE_TTL_MS;
  return _cache;
}

export function invalidateEmailConfigCache() {
  _cache = null;
  _cacheExpiry = 0;
}

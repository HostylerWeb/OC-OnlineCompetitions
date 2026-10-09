import { Competition, InstantPrize, Profile, Winner } from "@oc/api-db/models";

export type UsageKind = "competition" | "instantPrize" | "winner" | "profile";

export interface MediaUsage {
  kind: UsageKind;
  id: string;
  label: string;
  url?: string;
}

export interface UsageLookupResult {
  byUrl: Map<string, MediaUsage[]>;
}

const MAX_URLS_PER_CALL = 50;

function dedupeUrls(urls: string[]): string[] {
  return Array.from(new Set(urls.filter((u) => typeof u === "string" && u.length > 0)));
}

function splitUrlList(raw: string): string[] {
  return raw
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
}

export function parseUrlList(raw: string | null | undefined, max = MAX_URLS_PER_CALL): string[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  const urls = splitUrlList(raw);
  const deduped = dedupeUrls(urls);
  return deduped.slice(0, max);
}

export async function findMediaUsages(urls: string[]): Promise<UsageLookupResult> {
  const deduped = dedupeUrls(urls);
  const result: UsageLookupResult = { byUrl: new Map() };

  for (const url of deduped) {
    result.byUrl.set(url, []);
  }

  if (deduped.length === 0) return result;

  const urlOrList = { $in: deduped };

  const [competitions, instantPrizes, winners, profiles] = await Promise.all([
    Competition.find(
      {
        deletedAt: null,
        $or: [
          { imageUrl: urlOrList },
          { heroImageUrl: urlOrList },
          { prizeImageUrl: urlOrList },
          { prizeImages: urlOrList },
          { prizeImagesSource: urlOrList },
          { prizeImagesRemote: urlOrList },
        ],
      },
      "title slug _id"
    ).lean(),
    InstantPrize.find({ deletedAt: null, images: urlOrList }, "name _id").lean(),
    Winner.find({ prizeImageUrl: urlOrList }, "fullName _id").lean(),
    Profile.find({ avatarUrl: urlOrList }, "firstName lastName _id").lean(),
  ]);

  const pushToUrl = (url: string | null | undefined, usage: MediaUsage) => {
    if (!url) return;
    const bucket = result.byUrl.get(url);
    if (bucket) bucket.push(usage);
  };

  for (const c of competitions) {
    const row = c as unknown as {
      _id?: { toString(): string };
      slug?: string;
      title?: string;
      imageUrl?: string;
      heroImageUrl?: string;
      prizeImageUrl?: string;
      prizeImages?: string[];
      prizeImagesSource?: string;
      prizeImagesRemote?: string[];
    };
    const id = row._id?.toString() ?? "";
    const label = row.title || row.slug || id;
    const usage: MediaUsage = {
      kind: "competition",
      id,
      label,
      url: id ? `/admin/competitions/${id}` : undefined,
    };
    pushToUrl(row.imageUrl, usage);
    pushToUrl(row.heroImageUrl, usage);
    pushToUrl(row.prizeImageUrl, usage);
    if (Array.isArray(row.prizeImages)) {
      for (const url of row.prizeImages) pushToUrl(url, usage);
    }
    pushToUrl(row.prizeImagesSource, usage);
    if (Array.isArray(row.prizeImagesRemote)) {
      for (const url of row.prizeImagesRemote) pushToUrl(url, usage);
    }
  }

  for (const ip of instantPrizes) {
    const row = ip as unknown as {
      _id?: { toString(): string };
      name?: string;
      images?: string[];
    };
    const id = row._id?.toString() ?? "";
    const label = row.name || id;
    const usage: MediaUsage = {
      kind: "instantPrize",
      id,
      label,
      url: id ? `/admin/instant-prizes/${id}` : undefined,
    };
    if (Array.isArray(row.images)) {
      for (const url of row.images) pushToUrl(url, usage);
    }
  }

  for (const w of winners) {
    const row = w as unknown as {
      _id?: { toString(): string };
      fullName?: string;
      prizeImageUrl?: string;
    };
    const id = row._id?.toString() ?? "";
    const label = row.fullName || id;
    const usage: MediaUsage = {
      kind: "winner",
      id,
      label,
      url: id ? `/admin/winners/${id}` : undefined,
    };
    pushToUrl(row.prizeImageUrl, usage);
  }

  for (const p of profiles) {
    const row = p as unknown as {
      _id?: { toString(): string };
      firstName?: string;
      lastName?: string;
      avatarUrl?: string;
    };
    const id = row._id?.toString() ?? "";
    const label = [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || id;
    const usage: MediaUsage = {
      kind: "profile",
      id,
      label,
      url: id ? `/admin/users/${id}` : undefined,
    };
    pushToUrl(row.avatarUrl, usage);
  }

  return result;
}

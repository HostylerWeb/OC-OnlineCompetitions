import mongoose, { type Types } from "mongoose";

type IdLike = Types.ObjectId | string | { _id?: unknown } | null | undefined;

export interface FlattenedCompetitionInstantPrize {
  _id: string;
  title: string;
  description?: string;
  images: string[];
  value?: number;
  type?: "prize" | "competition_ticket";
  prizeCategory?: "cash" | "site_credit" | "physical";
  linkedCompetitionId?: string;
  linkedCompetitionSlug?: string;
  ticketCount?: number;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  if (value instanceof mongoose.Types.ObjectId) return false;
  if (value instanceof Date) return false;
  // Mongoose Documents are plain objects but should not be treated as plain records
  // because they have enumerable own properties and nested _id sub-documents that
  // cause infinite recursion in normalizeId.
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    // Check if it has a toString that indicates it's a mongoose Document
    const asString = String(value);
    if (asString === "[object Object]") {
      // Could be a Mongoose Document — check for known mongoose own symbols/keys
      // that indicate it's not a plain record
      const proto = Object.getPrototypeOf(value);
      if (proto?.constructor && proto.constructor.name !== "Object") {
        return false;
      }
    }
    return true;
  }
  return false;
}

export function normalizeId(value: IdLike): string | undefined {
  if (typeof value === "string") return value;
  if (!value) return undefined;

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }

  if (isRecord(value) && "_id" in value) {
    return normalizeId(value._id as IdLike);
  }

  if (typeof (value as { toString?: unknown }).toString === "function") {
    const asString = String(value);
    return asString && asString !== "[object Object]" ? asString : undefined;
  }

  return undefined;
}

export function normalizeGrantedEntryIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (isRecord(item) && "_id" in item) {
        return normalizeId(item._id as IdLike);
      }
      return normalizeId(item as IdLike);
    })
    .filter((id): id is string => Boolean(id));
}

export function flattenCompetitionInstantPrize(
  competitionInstantPrize: unknown
): FlattenedCompetitionInstantPrize {
  const cip = isRecord(competitionInstantPrize) ? competitionInstantPrize : {};
  const instantPrizeCandidate = cip.instantPrizeId;
  const instantPrize = isRecord(instantPrizeCandidate) ? instantPrizeCandidate : {};

  return {
    _id: normalizeId(cip._id as IdLike) ?? "",
    title: typeof instantPrize.title === "string" ? instantPrize.title : "",
    description:
      typeof instantPrize.description === "string" ? instantPrize.description : undefined,
    images: Array.isArray(instantPrize.images)
      ? instantPrize.images.filter((image): image is string => typeof image === "string")
      : [],
    value: typeof instantPrize.value === "number" ? instantPrize.value : undefined,
    type: (() => {
      const t = instantPrize.type as string;
      return t === "competition_ticket" || t === "prize"
        ? (t as "prize" | "competition_ticket")
        : undefined;
    })(),
    linkedCompetitionId: normalizeId(instantPrize.linkedCompetitionId as IdLike),
    linkedCompetitionSlug:
      isRecord(instantPrize.linkedCompetitionId) &&
      typeof (instantPrize.linkedCompetitionId as UnknownRecord).slug === "string"
        ? ((instantPrize.linkedCompetitionId as UnknownRecord).slug as string)
        : undefined,
    ticketCount:
      typeof instantPrize.ticketCount === "number" ? instantPrize.ticketCount : undefined,
    prizeCategory:
      instantPrize.prizeCategory === "cash" ||
      instantPrize.prizeCategory === "site_credit" ||
      instantPrize.prizeCategory === "physical"
        ? instantPrize.prizeCategory
        : undefined,
  };
}

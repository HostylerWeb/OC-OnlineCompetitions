import {
  Competition,
  CompetitionInstantPrize,
  InstantPrize,
  InstantPrizeWin,
} from "@oc/api-db/models";
import {
  flattenCompetitionInstantPrize,
  normalizeGrantedEntryIds,
  normalizeId,
} from "@oc/api-tickets/instant-prize-win-mapper";
import mongoose from "mongoose";

type LinkedCompetitionInfo = { title: string; slug?: string };

export function mapInstantPrizeWin(
  win: Record<string, unknown>,
  linkedCompetitionInfoMap: Map<string, LinkedCompetitionInfo>
) {
  const prize = flattenCompetitionInstantPrize(
    win.competitionInstantPrizeId as Record<string, unknown>
  );

  const isCompetitionTicket = prize.type === "competition_ticket";
  const linkedCompetitionInfo = prize.linkedCompetitionId
    ? linkedCompetitionInfoMap.get(prize.linkedCompetitionId)
    : undefined;

  const grantedEntryIds = normalizeGrantedEntryIds(
    win.grantedTicketIds ?? win.grantedEntryIds ?? []
  );

  return {
    _id: normalizeId(win._id as string | mongoose.Types.ObjectId | { _id?: unknown }) ?? "",
    ticketNumber: typeof win.ticketNumber === "number" ? win.ticketNumber : 0,
    claimed: Boolean(win.claimed) || isCompetitionTicket,
    claimedAt: win.claimedAt || (isCompetitionTicket ? win.wonAt : undefined),
    wonAt: win.wonAt,
    prize: {
      title: prize.title,
      description: prize.description ?? "",
      image: prize.images[0] ?? "",
      value: prize.value ?? 0,
    },
    prizeType: prize.type ?? "prize",
    linkedCompetitionTitle: linkedCompetitionInfo?.title,
    linkedCompetitionSlug: linkedCompetitionInfo?.slug,
    linkedCompetitionId: isCompetitionTicket ? prize.linkedCompetitionId : undefined,
    grantedTicketIds: grantedEntryIds,
    grantedEntryIds,
  };
}

export async function fetchAndMapWins(
  filter: Record<string, unknown>,
  options?: { skip?: number; limit?: number }
) {
  const { skip = 0, limit = 50 } = options ?? {};

  const hasExplicitPagination = skip > 0 || limit < 50;

  // Lazily resolve collection names to avoid accessing .collection at module load time
  const CIP_COLLECTION = CompetitionInstantPrize.collection.name;
  const PRIZE_COLLECTION = InstantPrize.collection.name;
  const COMP_COLLECTION = Competition.collection.name;

  filter.deletedAt = null;

  const pipeline: mongoose.PipelineStage[] = [
    { $match: filter },
    { $sort: { wonAt: -1 } },

    ...(hasExplicitPagination ? [{ $skip: skip }, { $limit: limit }] : []),

    // Lookup CompetitionInstantPrize (cip)
    {
      $lookup: {
        from: CIP_COLLECTION,
        localField: "competitionInstantPrizeId",
        foreignField: "_id",
        as: "cip",
      },
    },
    { $unwind: { path: "$cip", preserveNullAndEmptyArrays: true } },

    // Lookup InstantPrize (prize)
    {
      $lookup: {
        from: PRIZE_COLLECTION,
        localField: "cip.instantPrizeId",
        foreignField: "_id",
        as: "prize",
      },
    },
    { $unwind: { path: "$prize", preserveNullAndEmptyArrays: true } },

    // Lookup linked Competition (only relevant for competition_ticket prizes)
    {
      $lookup: {
        from: COMP_COLLECTION,
        let: { linkedId: "$prize.linkedCompetitionId" },
        pipeline: [{ $match: { _id: "$$linkedId" } }, { $project: { title: 1, slug: 1 } }],
        as: "linkedComp",
      },
    },
    { $unwind: { path: "$linkedComp", preserveNullAndEmptyArrays: true } },

    // Project final shape
    {
      $project: {
        _id: 1,
        ticketNumber: 1,
        claimed: {
          $cond: {
            if: { $eq: [{ $ifNull: ["$prize.type", ""] }, "competition_ticket"] },
            then: true,
            else: "$claimed",
          },
        },
        claimedAt: {
          $cond: {
            if: { $eq: [{ $ifNull: ["$prize.type", ""] }, "competition_ticket"] },
            then: "$wonAt",
            else: "$claimedAt",
          },
        },
        wonAt: 1,
        grantedTicketIds: {
          $map: {
            input: { $ifNull: ["$grantedTicketIds", []] },
            as: "id",
            in: { $toString: "$$id" },
          },
        },
        grantedEntryIds: {
          $map: {
            input: { $ifNull: ["$grantedTicketIds", []] },
            as: "id",
            in: { $toString: "$$id" },
          },
        },
        prize: {
          title: { $ifNull: ["$prize.title", ""] },
          description: { $ifNull: ["$prize.description", ""] },
          image: { $arrayElemAt: ["$prize.images", 0] },
          value: { $ifNull: ["$prize.value", 0] },
        },
        prizeType: { $ifNull: ["$prize.type", "prize"] },
        linkedCompetitionId: {
          $cond: {
            if: { $eq: [{ $ifNull: ["$prize.type", ""] }, "competition_ticket"] },
            then: { $toString: { $ifNull: ["$prize.linkedCompetitionId", null] } },
            else: null,
          },
        },
        linkedCompetitionTitle: { $ifNull: ["$linkedComp.title", null] },
        linkedCompetitionSlug: { $ifNull: ["$linkedComp.slug", null] },
      },
    },
  ];

  return InstantPrizeWin.aggregate(pipeline).option({ maxTimeMS: 5000 }).exec();
}

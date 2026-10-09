import { Competition, Ticket } from "@oc/api-db/models";
import { defaultAggregateOptions } from "@oc/api-infra/mongo-query-options";
import type { PipelineStage, Types } from "mongoose";

export type CompetitionMaxTicketsRow = {
  _id: Types.ObjectId;
  maxTickets: number;
  status?: string;
  title?: string;
};

export type ScopedStatusGroupRow = {
  _id: { competitionId: Types.ObjectId; status: string };
  raw: number;
  scoped: number;
};

export function buildMaxTicketsSwitchBranches(
  competitions: CompetitionMaxTicketsRow[]
): Array<{ case: Record<string, unknown>; then: number }> {
  return competitions.map((competition) => ({
    case: { $eq: ["$competitionId", competition._id] },
    // biome-ignore lint/suspicious/noThenProperty: MongoDB $switch syntax requires "then" key
    then: competition.maxTickets,
  }));
}

export function sumScopedByStatus(
  groups: ScopedStatusGroupRow[],
  statuses: string[]
): Record<string, number> {
  const totals = Object.fromEntries(statuses.map((status) => [status, 0]));

  for (const row of groups) {
    const status = row._id.status;
    if (statuses.includes(status)) {
      totals[status] = (totals[status] ?? 0) + row.scoped;
    }
  }

  return totals;
}

export function buildScopedTicketStatusPipeline(
  competitions: CompetitionMaxTicketsRow[],
  competitionIds: Types.ObjectId[]
): PipelineStage[] {
  const branches = buildMaxTicketsSwitchBranches(competitions);

  return [
    {
      $match: {
        status: { $in: ["sold", "held"] },
        competitionId: { $in: competitionIds },
      },
    },
    ...(branches.length > 0
      ? [
          {
            $addFields: {
              maxTickets: {
                $switch: {
                  branches,
                  default: Number.MAX_SAFE_INTEGER,
                },
              },
            },
          } as PipelineStage,
        ]
      : []),
    {
      $group: {
        _id: { competitionId: "$competitionId", status: "$status" },
        raw: { $sum: 1 },
        scoped: {
          $sum: {
            $cond: [{ $lte: ["$number", "$maxTickets"] }, 1, 0],
          },
        },
      },
    },
  ];
}

export async function loadCompetitionsForScopedStats(options?: {
  activeCompetitionsOnly?: boolean;
  competitionIds?: Types.ObjectId[];
}): Promise<CompetitionMaxTicketsRow[]> {
  const filter: Record<string, unknown> = {};

  if (options?.activeCompetitionsOnly) {
    filter.status = "active";
  }

  if (options?.competitionIds?.length) {
    filter._id = { $in: options.competitionIds };
  } else if (!options?.activeCompetitionsOnly) {
    const ticketCompIds = await Ticket.distinct("competitionId", {
      status: { $in: ["sold", "held"] },
    });
    if (ticketCompIds.length === 0) {
      return [];
    }
    filter._id = { $in: ticketCompIds };
  }

  return Competition.find(filter).select("_id maxTickets status title").lean();
}

export async function aggregateScopedTicketStatusGroups(options?: {
  activeCompetitionsOnly?: boolean;
  competitionIds?: Types.ObjectId[];
}): Promise<{ groups: ScopedStatusGroupRow[]; competitions: CompetitionMaxTicketsRow[] }> {
  const competitions = await loadCompetitionsForScopedStats(options);
  if (competitions.length === 0) {
    return { groups: [], competitions: [] };
  }

  const competitionIds = competitions.map((competition) => competition._id);
  const groups = await Ticket.aggregate<ScopedStatusGroupRow>(
    buildScopedTicketStatusPipeline(competitions, competitionIds)
  ).option(defaultAggregateOptions());

  return { groups, competitions };
}

export async function getGlobalScopedTicketStatusTotals(options?: {
  activeCompetitionsOnly?: boolean;
}): Promise<{ sold: number; held: number }> {
  const { groups } = await aggregateScopedTicketStatusGroups(options);
  const totals = sumScopedByStatus(groups, ["sold", "held"]);
  return {
    sold: totals.sold ?? 0,
    held: totals.held ?? 0,
  };
}

export function groupScopedRowsByCompetition(
  groups: ScopedStatusGroupRow[]
): Map<string, { soldRaw: number; soldScoped: number; heldRaw: number; heldScoped: number }> {
  const byCompetition = new Map<
    string,
    { soldRaw: number; soldScoped: number; heldRaw: number; heldScoped: number }
  >();

  for (const row of groups) {
    const competitionId = row._id.competitionId.toString();
    const counts = byCompetition.get(competitionId) ?? {
      soldRaw: 0,
      soldScoped: 0,
      heldRaw: 0,
      heldScoped: 0,
    };

    if (row._id.status === "sold") {
      counts.soldRaw = row.raw;
      counts.soldScoped = row.scoped;
    } else if (row._id.status === "held") {
      counts.heldRaw = row.raw;
      counts.heldScoped = row.scoped;
    }

    byCompetition.set(competitionId, counts);
  }

  return byCompetition;
}

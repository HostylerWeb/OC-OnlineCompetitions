import {
  BonusAward,
  BonusAwardFire,
  BonusAwardWin,
  Competition,
  CompetitionBonusAwardAssignment,
  type IBonusAwardWin,
  Profile,
} from "@oc/api-db/models";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { escapeRegex, substringRegex } from "@oc/api-infra/fuzzy-search";
import { parsePagination, parseSort } from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireManager } from "@oc/api-server/middleware/auth";
import { pickPendingBonusAwardWinners } from "@oc/api-tickets/bonus-award-draw";
import {
  type BonusAwardCapacityQueryInput,
  type BonusAwardWinBulkInput,
  type BonusAwardWinClaimInput,
  type BonusAwardWinsQueryInput,
  bonusAwardCapacityQuerySchema,
  bonusAwardWinBulkSchema,
  bonusAwardWinClaimSchema,
  bonusAwardWinsQuerySchema,
  type CreateAssignmentInput,
  type CreateBonusAwardInput,
  createAssignmentSchema,
  createBonusAwardSchema,
  type UpdateAssignmentInput,
  type UpdateBonusAwardInput,
  updateAssignmentSchema,
  updateBonusAwardSchema,
  validateBody,
  validateQuery,
} from "@oc/api-validation";
import type {
  AdminBonusAward,
  AdminBonusAwardAssignment,
  AdminBonusAwardWinItem,
  BonusAwardCapacityResponse,
} from "@oc/types";
import { ADMIN_BONUS_AWARD_ASSIGNMENT_TABLE, ADMIN_BONUS_AWARD_TABLE } from "@oc/types";
import { Hono } from "hono";
import { type PipelineStage, Types } from "mongoose";
import { notifyBonusAwardWins } from "../../lib/payment/notify-bonus-award-wins";

const app = new Hono();

app.use("*", requireManager);

const BA_COLLECTION = BonusAward.collection.name;
const BAW_COLLECTION = BonusAwardWin.collection.name;
const CBA_COLLECTION = CompetitionBonusAwardAssignment.collection.name;
const COMP_COLLECTION = Competition.collection.name;
const PROFILE_COLLECTION = Profile.collection.name;

function formatBonusAward(award: Record<string, unknown>): AdminBonusAward {
  return {
    _id: (award._id as Types.ObjectId).toString(),
    title: award.title as string,
    description: award.description as string | undefined,
    value: award.value as number | undefined,
    images: (award.images as string[]) ?? [],
    isActive: (award.isActive as boolean) ?? true,
    type: (award.type as "prize" | "competition_ticket") ?? "prize",
    linkedCompetitionId: award.linkedCompetitionId
      ? (award.linkedCompetitionId as Types.ObjectId).toString()
      : undefined,
    linkedCompetition: award.linkedCompetition as { title: string; imageUrl?: string } | undefined,
    ticketCount: award.ticketCount as number | undefined,
    sourceInstantPrizeId: award.sourceInstantPrizeId
      ? (award.sourceInstantPrizeId as Types.ObjectId).toString()
      : undefined,
    totalAssignments: (award.totalAssignments as number) ?? 0,
    totalWins: (award.totalWins as number) ?? 0,
    createdAt: (award.createdAt as Date).toISOString(),
    updatedAt: award.updatedAt ? (award.updatedAt as Date).toISOString() : undefined,
  };
}

function formatAssignment(assignment: Record<string, unknown>): AdminBonusAwardAssignment {
  return {
    _id: (assignment._id as Types.ObjectId).toString(),
    competitionId: (assignment.competitionId as Types.ObjectId).toString(),
    competitionTitle: assignment.competitionTitle as string | undefined,
    bonusAwardId: (assignment.bonusAwardId as Types.ObjectId).toString(),
    bonusAward: assignment.bonusAward
      ? formatBonusAward(assignment.bonusAward as Record<string, unknown>)
      : undefined,
    milestonePct: assignment.milestonePct as number,
    thresholdNumber: assignment.thresholdNumber as number,
    quantity: assignment.quantity as number,
    wonCount: assignment.wonCount as number,
    firedAt: assignment.firedAt ? (assignment.firedAt as Date).toISOString() : undefined,
    firedStatus: assignment.firedStatus as AdminBonusAwardAssignment["firedStatus"],
    isArchived: (assignment.isArchived as boolean) ?? false,
    wins: Array.isArray(assignment.wins)
      ? (assignment.wins as Array<Record<string, unknown>>).map((w) => ({
          _id: (w._id as Types.ObjectId).toString(),
          userId: (w.userId as Types.ObjectId).toString(),
          userEmail: w.userEmail as string,
          ticketNumber: w.ticketNumber as number,
          prizeTitle: w.prizeTitle as string,
          prizeValue: w.prizeValue as number,
          claimed: (w.claimed as boolean) ?? false,
          claimedAt: w.claimedAt ? (w.claimedAt as Date).toISOString() : undefined,
          wonAt: (w.wonAt as Date).toISOString(),
        }))
      : undefined,
    createdAt: (assignment.createdAt as Date).toISOString(),
    updatedAt: assignment.updatedAt ? (assignment.updatedAt as Date).toISOString() : undefined,
  };
}

// ─── Template routes (BonusAward — pure prize template) ───────────────────────

app.get("/", async (c) => {
  try {
    const { limit, page } = parsePagination(c);
    const { sortObj, sortableFields } = parseSort(c, {
      fields: [...ADMIN_BONUS_AWARD_TABLE.sortableFields],
      defaultSort: { createdAt: -1 },
    });
    const search = c.req.query("search");
    const showDeleted = c.req.query("showDeleted") === "true";
    await dbConnect();

    const matchQuery: Record<string, unknown> = {};
    if (!showDeleted) {
      matchQuery.deletedAt = null;
    }

    const basePipeline: PipelineStage[] = [
      { $match: matchQuery },

      {
        $lookup: {
          from: COMP_COLLECTION,
          localField: "linkedCompetitionId",
          foreignField: "_id",
          as: "linkedComp",
        },
      },
      { $unwind: { path: "$linkedComp", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: CBA_COLLECTION,
          localField: "_id",
          foreignField: "bonusAwardId",
          as: "assignments",
        },
      },

      {
        $lookup: {
          from: BAW_COLLECTION,
          localField: "_id",
          foreignField: "bonusAwardId",
          as: "wins",
        },
      },

      {
        $addFields: {
          totalAssignments: { $size: "$assignments" },
          totalWins: { $size: "$wins" },
        },
      },

      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          value: 1,
          images: 1,
          isActive: 1,
          type: 1,
          linkedCompetitionId: 1,
          linkedCompetition: {
            title: { $ifNull: ["$linkedComp.title", ""] },
            imageUrl: "$linkedComp.imageUrl",
            status: "$linkedComp.status",
          },
          ticketCount: 1,
          sourceInstantPrizeId: 1,
          totalAssignments: 1,
          totalWins: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },

      ...(search
        ? [
            {
              $match: {
                $or: [
                  { title: { $regex: substringRegex(search), $options: "i" } },
                  { description: { $regex: substringRegex(search), $options: "i" } },
                ],
              },
            } as PipelineStage,
          ]
        : []),
    ];

    const sortStage =
      Object.keys(sortObj).length > 0
        ? ({ $sort: sortObj as Record<string, 1 | -1> } as PipelineStage)
        : ({ $sort: { createdAt: -1 as const } } as PipelineStage);
    const skipStage = { $skip: (page - 1) * limit } as PipelineStage;
    const limitStage = { $limit: limit } as PipelineStage;

    const dataPipeline = [...basePipeline, sortStage, skipStage, limitStage];

    const countPipeline: PipelineStage[] = [
      { $match: matchQuery },
      ...(search
        ? [
            {
              $match: {
                $or: [
                  { title: { $regex: substringRegex(search), $options: "i" } },
                  { description: { $regex: substringRegex(search), $options: "i" } },
                ],
              },
            } as PipelineStage,
          ]
        : []),
      { $count: "total" },
    ];

    const [awards, countResult] = await Promise.all([
      BonusAward.aggregate(dataPipeline).option({ maxTimeMS: 5000 }).exec(),
      BonusAward.aggregate(countPipeline).option({ maxTimeMS: 5000 }).exec(),
    ]);

    const total = countResult.length > 0 ? (countResult[0] as { total: number }).total : 0;
    const results = awards.map((a) => formatBonusAward(a as unknown as Record<string, unknown>));

    return paginated(c, results, total, page, limit, { sortableFields });
  } catch (err: unknown) {
    console.error("Error listing bonus award templates:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.bonusAwards.templates.list",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post(
  "/",
  async (c, next) => validateBody(c, next, createBonusAwardSchema),
  async (c) => {
    try {
      const body = c.get("body") as CreateBonusAwardInput;
      await dbConnect();

      const data: Record<string, unknown> = {
        title: body.title,
        description: body.description,
        value: body.value,
        images: body.images,
        isActive: body.isActive,
        type: body.type,
        ticketCount: body.ticketCount,
      };
      if (body.linkedCompetitionId) {
        const lid = body.linkedCompetitionId;
        if (!Types.ObjectId.isValid(lid)) {
          return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid linked competition ID", 400);
        }
        const linked = await Competition.findById(lid).lean();
        if (!linked) {
          return error(c, ErrorCodes.NOT_FOUND, "Linked competition not found", 404);
        }
        if (linked.status !== "active") {
          return error(
            c,
            ErrorCodes.VALIDATION_ERROR,
            `Cannot link to a ${linked.status} competition`,
            400
          );
        }
        data.linkedCompetitionId = new Types.ObjectId(lid);
      }
      if (body.sourceInstantPrizeId) {
        data.sourceInstantPrizeId = new Types.ObjectId(body.sourceInstantPrizeId);
      }

      const award = await BonusAward.create(data);

      await invalidateByChannelSafe(
        CH.bonusAwardTemplates,
        CH.competitions,
        CH.competitionDetail,
        CH.landingPage
      );

      return success(c, formatBonusAward(award.toObject() as unknown as Record<string, unknown>));
    } catch (err: unknown) {
      console.error("Error creating bonus award template:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.bonusAwards.templates.create",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

// ─── Assignment routes (CompetitionBonusAwardAssignment) ──────────────────────

app.get("/competitions/:id/assignments", async (c) => {
  try {
    const { limit, page } = parsePagination(c);
    const competitionId = c.req.param("id");
    const { sortObj, sortableFields } = parseSort(c, {
      fields: [...ADMIN_BONUS_AWARD_ASSIGNMENT_TABLE.sortableFields],
      defaultSort: { milestonePct: 1 },
    });
    const search = c.req.query("search");
    const isArchived = c.req.query("isArchived");
    await dbConnect();

    const matchQuery: Record<string, unknown> = {
      competitionId: new Types.ObjectId(competitionId),
      deletedAt: null,
    };
    if (isArchived !== undefined) {
      matchQuery.isArchived = isArchived === "true";
    }

    const basePipeline: PipelineStage[] = [
      { $match: matchQuery },

      {
        $lookup: {
          from: BA_COLLECTION,
          localField: "bonusAwardId",
          foreignField: "_id",
          as: "bonusAward",
        },
      },
      { $unwind: { path: "$bonusAward", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: COMP_COLLECTION,
          localField: "competitionId",
          foreignField: "_id",
          as: "comp",
        },
      },
      { $unwind: { path: "$comp", preserveNullAndEmptyArrays: true } },

      {
        $addFields: {
          competitionTitle: { $ifNull: ["$comp.title", ""] },
        },
      },

      {
        $project: {
          _id: 1,
          competitionId: 1,
          competitionTitle: 1,
          bonusAwardId: 1,
          bonusAward: 1,
          milestonePct: 1,
          thresholdNumber: 1,
          quantity: 1,
          wonCount: 1,
          firedAt: 1,
          firedStatus: 1,
          isArchived: 1,
          wins: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },

      ...(search
        ? [
            {
              $match: {
                $or: [
                  {
                    "bonusAward.title": {
                      $regex: substringRegex(search),
                      $options: "i",
                    },
                  },
                  {
                    competitionTitle: {
                      $regex: substringRegex(search),
                      $options: "i",
                    },
                  },
                ],
              },
            } as PipelineStage,
          ]
        : []),

      {
        $lookup: {
          from: BAW_COLLECTION,
          let: { assignmentId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$assignmentId", "$$assignmentId"] }, deletedAt: null } },
            {
              $lookup: {
                from: PROFILE_COLLECTION,
                let: { userId: "$userId" },
                pipeline: [
                  { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
                  { $project: { _id: 0, email: 1 } },
                ],
                as: "winUser",
              },
            },
            { $unwind: { path: "$winUser", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 1,
                userId: 1,
                ticketNumber: 1,
                prizeTitle: 1,
                prizeValue: 1,
                claimed: 1,
                claimedAt: 1,
                wonAt: 1,
                userEmail: { $ifNull: ["$winUser.email", ""] },
              },
            },
          ],
          as: "wins",
        },
      } as PipelineStage,
    ];

    const sortStage =
      Object.keys(sortObj).length > 0
        ? ({ $sort: sortObj as Record<string, 1 | -1> } as PipelineStage)
        : ({ $sort: { milestonePct: 1 as const } } as PipelineStage);
    const skipStage = { $skip: (page - 1) * limit } as PipelineStage;
    const limitStage = { $limit: limit } as PipelineStage;

    const dataPipeline = [...basePipeline, sortStage, skipStage, limitStage];

    const countPipeline: PipelineStage[] = [
      { $match: matchQuery },
      ...(search
        ? ([
            {
              $lookup: {
                from: BA_COLLECTION,
                localField: "bonusAwardId",
                foreignField: "_id",
                as: "bonusAward",
              },
            },
            {
              $unwind: { path: "$bonusAward", preserveNullAndEmptyArrays: true },
            },
            {
              $lookup: {
                from: COMP_COLLECTION,
                localField: "competitionId",
                foreignField: "_id",
                as: "comp",
              },
            },
            {
              $unwind: { path: "$comp", preserveNullAndEmptyArrays: true },
            },
            {
              $match: {
                $or: [
                  {
                    "bonusAward.title": {
                      $regex: substringRegex(search),
                      $options: "i",
                    },
                  },
                  {
                    competitionTitle: {
                      $regex: substringRegex(search),
                      $options: "i",
                    },
                  },
                ],
              },
            },
          ] as PipelineStage[])
        : []),
      { $count: "total" },
    ];

    const [assignments, countResult] = await Promise.all([
      CompetitionBonusAwardAssignment.aggregate(dataPipeline).option({ maxTimeMS: 5000 }).exec(),
      CompetitionBonusAwardAssignment.aggregate(countPipeline).option({ maxTimeMS: 5000 }).exec(),
    ]);

    const total = countResult.length > 0 ? (countResult[0] as { total: number }).total : 0;
    const results = assignments.map((a) =>
      formatAssignment(a as unknown as Record<string, unknown>)
    );

    return paginated(c, results, total, page, limit, { sortableFields });
  } catch (err: unknown) {
    console.error("Error listing bonus award assignments:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.bonusAwards.assignments.list",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get(
  "/competitions/:id/assignments/capacity",
  async (c, next) => validateQuery(c, next, bonusAwardCapacityQuerySchema),
  async (c) => {
    try {
      const competitionId = c.req.param("id");
      const query = c.get("query") as BonusAwardCapacityQueryInput;
      await dbConnect();

      const competition = await Competition.findById(competitionId).lean();
      if (!competition) {
        return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
      }

      const match: Record<string, unknown> = {
        competitionId: new Types.ObjectId(competitionId),
        isArchived: false,
      };
      if (query.excludeAssignmentId) {
        match._id = { $ne: new Types.ObjectId(query.excludeAssignmentId) };
      }

      const activeAssignments = await CompetitionBonusAwardAssignment.find(match)
        .select("milestonePct")
        .lean();
      const usedMilestones = activeAssignments.length;
      const usedPcts = activeAssignments.map((a) => a.milestonePct);
      const maxMilestones = 99;
      const availableMilestones = maxMilestones - usedMilestones;

      const firedCount = await BonusAwardFire.countDocuments({
        competitionId: new Types.ObjectId(competitionId),
      });

      const response: BonusAwardCapacityResponse = {
        competitionId,
        maxTickets: competition.maxTickets,
        maxMilestones,
        usedMilestones,
        availableMilestones,
        usedPcts,
        firedCount,
      };

      return success(c, response);
    } catch (err: unknown) {
      console.error("Error getting bonus award capacity:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.bonusAwards.assignments.capacity",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.post(
  "/competitions/:id/assignments",
  async (c, next) => validateBody(c, next, createAssignmentSchema),
  async (c) => {
    try {
      const competitionId = c.req.param("id");
      const body = c.get("body") as CreateAssignmentInput;
      const { bonusAwardId, milestonePct, quantity } = body;
      await dbConnect();

      const competition = await Competition.findById(competitionId).lean();
      if (!competition) {
        return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
      }

      if (competition.status !== "active") {
        return error(
          c,
          ErrorCodes.VALIDATION_ERROR,
          `Cannot assign bonus awards to a ${competition.status} competition`,
          400
        );
      }

      const bonusAward = await BonusAward.findById(bonusAwardId).lean();
      if (!bonusAward) {
        return error(c, ErrorCodes.NOT_FOUND, "Bonus award template not found", 404);
      }

      const existingActive = await CompetitionBonusAwardAssignment.findOne({
        competitionId: new Types.ObjectId(competitionId),
        milestonePct,
        isArchived: false,
      }).lean();

      if (existingActive) {
        return error(
          c,
          ErrorCodes.VALIDATION_ERROR,
          `An assignment already exists for milestone ${milestonePct}% on this competition`,
          400
        );
      }

      const thresholdNumber = Math.floor((competition.maxTickets * milestonePct) / 100);

      const assignment = await CompetitionBonusAwardAssignment.create({
        competitionId: new Types.ObjectId(competitionId),
        bonusAwardId: new Types.ObjectId(bonusAwardId),
        milestonePct,
        thresholdNumber,
        quantity: quantity ?? 1,
        wonCount: 0,
        isArchived: false,
      });

      await BonusAward.findByIdAndUpdate(bonusAwardId, {
        $inc: { totalAssignments: 1 },
      });

      await invalidateByChannelSafe(
        CH.bonusAwardAssignments,
        CH.bonusAwardTemplates,
        CH.competitions,
        CH.competitionDetail,
        CH.landingPage
      );

      return success(
        c,
        formatAssignment(assignment.toObject() as unknown as Record<string, unknown>)
      );
    } catch (err: unknown) {
      console.error("Error creating bonus award assignment:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.bonusAwards.assignments.create",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.patch(
  "/assignments/:assignmentId",
  async (c, next) => validateBody(c, next, updateAssignmentSchema),
  async (c) => {
    try {
      const assignmentId = c.req.param("assignmentId");
      const body = c.get("body") as UpdateAssignmentInput;
      const { milestonePct, quantity, isArchived } = body;
      await dbConnect();

      const assignment = await CompetitionBonusAwardAssignment.findById(assignmentId).lean();
      if (!assignment) {
        return error(c, ErrorCodes.NOT_FOUND, "Assignment not found", 404);
      }

      if (assignment.isArchived && isArchived !== false) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "Cannot update an archived assignment", 400);
      }

      const competition = await Competition.findById(assignment.competitionId).lean();
      if (competition && competition.status !== "active") {
        return error(
          c,
          ErrorCodes.VALIDATION_ERROR,
          `Cannot modify bonus awards for a ${competition.status} competition`,
          400
        );
      }

      if (assignment.firedAt && (milestonePct !== undefined || quantity !== undefined)) {
        return error(
          c,
          ErrorCodes.VALIDATION_ERROR,
          "Cannot change milestonePct or quantity after the assignment has been fired",
          400
        );
      }

      if (milestonePct !== undefined && assignment.firedAt) {
        return error(
          c,
          ErrorCodes.VALIDATION_ERROR,
          "Cannot change milestonePct after the assignment has fired",
          400
        );
      }

      if (milestonePct !== undefined) {
        const duplicate = await CompetitionBonusAwardAssignment.findOne({
          competitionId: assignment.competitionId,
          milestonePct,
          _id: { $ne: assignment._id },
          isArchived: false,
        }).lean();

        if (duplicate) {
          return error(
            c,
            ErrorCodes.VALIDATION_ERROR,
            `An assignment already exists for milestone ${milestonePct}% on this competition`,
            400
          );
        }
      }

      const updateData: Record<string, unknown> = {};
      if (milestonePct !== undefined) updateData.milestonePct = milestonePct;
      if (quantity !== undefined) updateData.quantity = quantity;
      if (isArchived !== undefined) updateData.isArchived = isArchived;

      const updated = await CompetitionBonusAwardAssignment.findByIdAndUpdate(
        assignmentId,
        updateData,
        { returnDocument: "after" }
      ).lean();

      if (!updated) {
        return error(c, ErrorCodes.NOT_FOUND, "Assignment not found", 404);
      }

      await invalidateByChannelSafe(
        CH.bonusAwardAssignments,
        CH.bonusAwardTemplates,
        CH.competitions,
        CH.competitionDetail,
        CH.landingPage
      );

      return success(c, formatAssignment(updated as unknown as Record<string, unknown>));
    } catch (err: unknown) {
      console.error("Error updating bonus award assignment:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.bonusAwards.assignments.update",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.delete("/assignments/:assignmentId", async (c) => {
  try {
    const assignmentId = c.req.param("assignmentId");
    await dbConnect();

    const assignment = await CompetitionBonusAwardAssignment.findById(assignmentId).lean();
    if (!assignment) {
      return error(c, ErrorCodes.NOT_FOUND, "Assignment not found", 404);
    }

    if (assignment.deletedAt) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Assignment is already deleted", 400);
    }

    const competition = await Competition.findById(assignment.competitionId).lean();
    if (competition && competition.status !== "active") {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        `Cannot modify bonus awards for a ${competition.status} competition`,
        400
      );
    }

    if (assignment.wonCount > 0) {
      await CompetitionBonusAwardAssignment.findByIdAndUpdate(assignmentId, {
        isArchived: true,
      });

      await BonusAward.findByIdAndUpdate(assignment.bonusAwardId, {
        $inc: { totalAssignments: -1 },
      });

      await invalidateByChannelSafe(
        CH.bonusAwardAssignments,
        CH.bonusAwardTemplates,
        CH.competitions,
        CH.competitionDetail,
        CH.landingPage
      );

      return success(c, { success: true, archived: true });
    }

    await CompetitionBonusAwardAssignment.findByIdAndUpdate(assignmentId, {
      deletedAt: new Date(),
      isArchived: true,
    });

    await BonusAward.findByIdAndUpdate(assignment.bonusAwardId, {
      $inc: { totalAssignments: -1 },
    });

    await invalidateByChannelSafe(
      CH.bonusAwardAssignments,
      CH.bonusAwardTemplates,
      CH.competitions,
      CH.competitionDetail,
      CH.landingPage
    );

    return success(c, { success: true, deleted: true });
  } catch (err: unknown) {
    console.error("Error deleting bonus award assignment:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.bonusAwards.assignments.delete",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/assignments/:assignmentId/restore", async (c) => {
  try {
    const assignmentId = c.req.param("assignmentId");
    await dbConnect();

    const assignment = await CompetitionBonusAwardAssignment.findById(assignmentId).lean();
    if (!assignment) {
      return error(c, ErrorCodes.NOT_FOUND, "Assignment not found", 404);
    }

    if (!assignment.deletedAt) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Assignment is not deleted", 400);
    }

    const competition = await Competition.findById(assignment.competitionId).lean();
    if (competition && competition.status !== "active") {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        `Cannot restore assignment for a ${competition.status} competition`,
        400
      );
    }

    await CompetitionBonusAwardAssignment.findByIdAndUpdate(assignmentId, {
      isArchived: false,
      $unset: { deletedAt: 1 },
    });

    await BonusAward.findByIdAndUpdate(assignment.bonusAwardId, {
      $inc: { totalAssignments: 1 },
    });

    await invalidateByChannelSafe(
      CH.bonusAwardAssignments,
      CH.bonusAwardTemplates,
      CH.competitions,
      CH.competitionDetail,
      CH.landingPage
    );

    return success(c, { restored: true });
  } catch (err: unknown) {
    console.error("Error restoring bonus award assignment:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.bonusAwards.assignments.restore",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

// ─── Wins routes ──────────────────────────────────────────────────────────────

app.get(
  "/wins",
  async (c, next) => validateQuery(c, next, bonusAwardWinsQuerySchema),
  async (c) => {
    try {
      const query = c.get("query") as BonusAwardWinsQueryInput;
      await dbConnect();

      const page = query.page;
      const limit = query.limit;

      const sortDir = query.sortDir === "asc" ? 1 : -1;
      const sortFieldMap: Record<string, string> = {
        wonAt: "wonAt",
        ticketNumber: "ticketNumber",
        prizeTitle: "prizeTitle",
        prizeValue: "prizeValue",
      };
      const sortField =
        query.sortField && sortFieldMap[query.sortField] ? sortFieldMap[query.sortField] : "wonAt";
      const sortObj = { [sortField]: sortDir };

      const match: Record<string, unknown> = {};

      if (!query.showDeleted) {
        match.deletedAt = null;
      }

      if (query.competitionId) {
        match.competitionId = new Types.ObjectId(query.competitionId);
      }
      if (query.assignmentId) {
        match.assignmentId = new Types.ObjectId(query.assignmentId);
      }
      if (query.bonusAwardId) {
        match.bonusAwardId = new Types.ObjectId(query.bonusAwardId);
      }
      if (query.claimed === "true") {
        match.claimed = true;
      } else if (query.claimed === "false") {
        match.claimed = false;
      }
      if (query.wonAtFrom || query.wonAtTo) {
        const wonAtFilter: Record<string, Date> = {};
        if (query.wonAtFrom) wonAtFilter.$gte = new Date(query.wonAtFrom);
        if (query.wonAtTo) wonAtFilter.$lte = new Date(query.wonAtTo);
        match.wonAt = wonAtFilter;
      }

      const pipeline: PipelineStage[] = [
        { $match: match },

        {
          $lookup: {
            from: CBA_COLLECTION,
            localField: "assignmentId",
            foreignField: "_id",
            as: "assignment",
          },
        },
        { $unwind: { path: "$assignment", preserveNullAndEmptyArrays: true } },

        {
          $lookup: {
            from: COMP_COLLECTION,
            localField: "competitionId",
            foreignField: "_id",
            as: "comp",
          },
        },
        { $unwind: { path: "$comp", preserveNullAndEmptyArrays: true } },

        {
          $lookup: {
            from: PROFILE_COLLECTION,
            localField: "userId",
            foreignField: "_id",
            as: "profile",
          },
        },
        { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },

        {
          $project: {
            _id: 1,
            assignmentId: 1,
            bonusAwardId: 1,
            bonusAwardFireId: 1,
            competitionId: 1,
            userId: 1,
            ticketNumber: 1,
            prizeTitle: 1,
            prizeValue: 1,
            prizeImage: 1,
            wonAt: 1,
            notifiedAt: 1,
            claimed: 1,
            claimedAt: 1,
            milestonePct: { $ifNull: ["$assignment.milestonePct", 0] },
            competitionTitle: { $ifNull: ["$comp.title", ""] },
            userEmail: { $ifNull: ["$profile.email", ""] },
          },
        },

        ...(query.search
          ? [
              {
                $match: {
                  $or: [
                    { prizeTitle: { $regex: escapeRegex(query.search), $options: "i" } },
                    { userEmail: { $regex: escapeRegex(query.search), $options: "i" } },
                    {
                      $expr: {
                        $regexMatch: {
                          input: { $toString: "$ticketNumber" },
                          regex: escapeRegex(query.search),
                          options: "i",
                        },
                      },
                    },
                  ],
                },
              } as PipelineStage,
            ]
          : []),
      ];

      const countPipeline: PipelineStage[] = [...pipeline, { $count: "total" }];
      const dataPipeline: PipelineStage[] = [
        ...pipeline,
        { $sort: sortObj as Record<string, 1 | -1> },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ];

      const [wins, countResult] = await Promise.all([
        BonusAwardWin.aggregate(dataPipeline).option({ maxTimeMS: 5000 }).exec(),
        BonusAwardWin.aggregate(countPipeline).option({ maxTimeMS: 5000 }).exec(),
      ]);

      const total = countResult.length > 0 ? (countResult[0] as { total: number }).total : 0;

      const results = wins.map(
        (w) =>
          ({
            _id: w._id.toString(),
            assignmentId: w.assignmentId.toString(),
            bonusAwardId: w.bonusAwardId.toString(),
            bonusAwardFireId: w.bonusAwardFireId.toString(),
            competitionId: w.competitionId.toString(),
            competitionTitle: w.competitionTitle,
            milestonePct: w.milestonePct,
            userId: w.userId.toString(),
            userEmail: w.userEmail,
            ticketNumber: w.ticketNumber,
            prizeTitle: w.prizeTitle,
            prizeValue: w.prizeValue,
            prizeImage: w.prizeImage,
            wonAt: (w.wonAt as Date).toISOString(),
            notifiedAt: w.notifiedAt ? (w.notifiedAt as Date).toISOString() : undefined,
            claimed: w.claimed,
            claimedAt: w.claimedAt ? (w.claimedAt as Date).toISOString() : undefined,
          }) as AdminBonusAwardWinItem
      );

      return paginated(c, results, total, page, limit);
    } catch (err: unknown) {
      console.error("Error listing bonus award wins:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.bonusAwards.wins.list",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.patch(
  "/wins/:winId/claim",
  async (c, next) => validateBody(c, next, bonusAwardWinClaimSchema),
  async (c) => {
    try {
      const winId = c.req.param("winId");
      const body = c.get("body") as BonusAwardWinClaimInput;
      const { claimed } = body;
      await dbConnect();

      const win = await BonusAwardWin.findById(winId).lean();
      if (!win) {
        return error(c, ErrorCodes.NOT_FOUND, "Bonus award win not found", 404);
      }

      if (win.deletedAt) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "Cannot update a deleted win record", 400);
      }

      const updateData: Record<string, unknown> = { claimed };
      if (claimed) {
        updateData.claimedAt = new Date();
      } else {
        updateData.claimedAt = null;
      }

      await BonusAwardWin.findByIdAndUpdate(winId, updateData);

      await invalidateByChannelSafe(
        CH.bonusAwardWins,
        CH.bonusAwardTemplates,
        CH.competitions,
        CH.competitionDetail,
        CH.landingPage
      );

      return success(c, { success: true, claimed });
    } catch (err: unknown) {
      console.error("Error claiming bonus award win:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.bonusAwards.wins.claim",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.delete("/wins/:winId", async (c) => {
  try {
    const winId = c.req.param("winId");
    await dbConnect();

    const win = await BonusAwardWin.findById(winId).lean();
    if (!win) {
      return error(c, ErrorCodes.NOT_FOUND, "Bonus award win not found", 404);
    }

    if (win.claimed) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Cannot delete a claimed win record", 400);
    }

    if (win.deletedAt) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Win record is already deleted", 400);
    }

    await BonusAwardWin.findByIdAndUpdate(winId, {
      deletedAt: new Date(),
    });

    await invalidateByChannelSafe(
      CH.bonusAwardWins,
      CH.bonusAwardTemplates,
      CH.competitions,
      CH.competitionDetail,
      CH.landingPage
    );

    return success(c, { success: true });
  } catch (err: unknown) {
    console.error("Error deleting bonus award win:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.bonusAwards.wins.delete",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/wins/:winId/restore", async (c) => {
  try {
    const winId = c.req.param("winId");
    await dbConnect();

    const win = await BonusAwardWin.findById(winId).lean();
    if (!win) {
      return error(c, ErrorCodes.NOT_FOUND, "Bonus award win not found", 404);
    }
    if (!win.deletedAt) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Win is not deleted", 400);
    }

    await BonusAwardWin.findByIdAndUpdate(winId, { $unset: { deletedAt: 1 } });

    await invalidateByChannelSafe(
      CH.bonusAwardWins,
      CH.bonusAwardTemplates,
      CH.competitions,
      CH.competitionDetail,
      CH.landingPage
    );

    return success(c, { success: true });
  } catch (err: unknown) {
    console.error("Error restoring bonus award win:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.bonusAwards.wins.restore",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post(
  "/wins/bulk",
  async (c, next) => validateBody(c, next, bonusAwardWinBulkSchema),
  async (c) => {
    try {
      const body = c.get("body") as BonusAwardWinBulkInput;
      const { action, ids } = body;
      await dbConnect();

      const objectIds = ids.map((id: string) => new Types.ObjectId(id));

      if (action === "delete") {
        const alreadyClaimed = await BonusAwardWin.countDocuments({
          _id: { $in: objectIds },
          claimed: true,
          deletedAt: null,
        });
        if (alreadyClaimed > 0) {
          return error(
            c,
            ErrorCodes.VALIDATION_ERROR,
            `${alreadyClaimed} win(s) are already claimed and cannot be deleted`,
            400
          );
        }
        await BonusAwardWin.updateMany(
          { _id: { $in: objectIds }, deletedAt: null },
          { $set: { deletedAt: new Date() } }
        );
      } else {
        const claimed = action === "claim";
        const updateData: Record<string, unknown> = { claimed };
        if (claimed) {
          updateData.claimedAt = new Date();
        } else {
          updateData.claimedAt = null;
        }
        await BonusAwardWin.updateMany(
          { _id: { $in: objectIds }, deletedAt: null },
          { $set: updateData }
        );
      }

      await invalidateByChannelSafe(
        CH.bonusAwardWins,
        CH.bonusAwardTemplates,
        CH.competitions,
        CH.competitionDetail,
        CH.landingPage
      );

      return success(c, { success: true, action, count: objectIds.length });
    } catch (err: unknown) {
      console.error("Error executing bulk wins action:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.bonusAwards.wins.bulk",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

// ─── Fires routes ────────────────────────────────────────────────────────────

app.get("/fires", async (c) => {
  try {
    await dbConnect();
    const statusFilter = c.req.query("status");
    const filter: Record<string, unknown> = {};
    if (
      statusFilter &&
      ["pending", "drawing", "drawn", "no_eligible_tickets", "failed", "all"].includes(statusFilter)
    ) {
      if (statusFilter !== "all") filter.status = statusFilter;
    } else {
      filter.status = { $in: ["pending", "drawing", "failed", "no_eligible_tickets"] };
    }

    const fires = await BonusAwardFire.find(filter)
      .populate({
        path: "competitionId",
        select: "title slug maxTickets",
      })
      .populate({
        path: "assignmentId",
        select: "milestonePct quantity thresholdNumber",
      })
      .sort({ firedAt: 1 })
      .lean();

    return success(c, { data: fires });
  } catch (err: unknown) {
    console.error("Error listing bonus award fires:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.bonusAwards.fires.list",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/fires/:fireId/retrigger", async (c) => {
  try {
    await dbConnect();
    const fireId = c.req.param("fireId");
    const fire = await BonusAwardFire.findById(fireId)
      .populate({
        path: "competitionId",
        select: "title status",
      })
      .lean();

    if (!fire) {
      return error(c, ErrorCodes.NOT_FOUND, "Fire not found", 404);
    }

    if (fire.status === "drawn") {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Already awarded — cannot retrigger", 409);
    }
    if (fire.status === "pending") {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Fire is already pending", 409);
    }

    const comp = fire.competitionId as { title?: string; status?: string } | null;
    if (comp && comp.status !== "active") {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        `Cannot retrigger fires for a ${comp.status} competition`,
        400
      );
    }

    await BonusAwardFire.updateOne(
      { _id: fire._id },
      { $set: { status: "pending" }, $unset: { drawnAt: 1, error: 1 } }
    );

    const competitionName =
      (fire.competitionId as { title?: string } | null)?.title ?? "Competition";

    await pickPendingBonusAwardWinners(
      [fire._id],
      async (wins) => {
        const pendingFires = await BonusAwardFire.find({
          competitionId: fire.competitionId,
          status: "pending",
        }).lean();
        await notifyBonusAwardWins({
          wins: wins as unknown as IBonusAwardWin[],
          pendingFires: pendingFires as unknown as Array<{
            _id: Types.ObjectId;
            milestonePct: number;
          }>,
          competitionName,
        }).catch((notifyErr) => {
          console.error(
            "[admin.bonusAwards.fires.retrigger] notifyBonusAwardWins failed:",
            notifyErr
          );
        });
      },
      undefined,
      false
    );

    const updatedFire = await BonusAwardFire.findById(fireId).lean();
    return success(c, {
      fireId: updatedFire?._id,
      newStatus: updatedFire?.status ?? "unknown",
      error: updatedFire?.error ?? undefined,
    });
  } catch (err: unknown) {
    console.error("Error retriggering bonus award fire:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.bonusAwards.fires.retrigger",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

// Backward-compat alias
app.get("/fires/pending", async (c) => {
  const url = new URL(c.req.url);
  url.searchParams.set("status", "pending");
  return c.redirect(url.pathname.replace("/fires/pending", "/fires") + url.search);
});

app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    const [award] = await BonusAward.aggregate([
      { $match: { _id: new Types.ObjectId(id) } },

      {
        $lookup: {
          from: COMP_COLLECTION,
          localField: "linkedCompetitionId",
          foreignField: "_id",
          as: "linkedComp",
        },
      },
      { $unwind: { path: "$linkedComp", preserveNullAndEmptyArrays: true } },

      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          value: 1,
          images: 1,
          isActive: 1,
          type: 1,
          linkedCompetitionId: 1,
          linkedCompetition: {
            title: { $ifNull: ["$linkedComp.title", ""] },
            imageUrl: "$linkedComp.imageUrl",
            status: "$linkedComp.status",
          },
          ticketCount: 1,
          sourceInstantPrizeId: 1,
          totalAssignments: 1,
          totalWins: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ]);

    if (!award) {
      return error(c, ErrorCodes.NOT_FOUND, "Bonus award template not found", 404);
    }

    return success(c, formatBonusAward(award as unknown as Record<string, unknown>));
  } catch (err: unknown) {
    console.error("Error getting bonus award template:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.bonusAwards.templates.get",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.put(
  "/:id",
  async (c, next) => validateBody(c, next, updateBonusAwardSchema),
  async (c) => {
    try {
      const id = c.req.param("id");
      const body = c.get("body") as UpdateBonusAwardInput;
      await dbConnect();

      const updateData: Record<string, unknown> = {};
      if (body.title !== undefined) updateData.title = body.title;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.value !== undefined) updateData.value = body.value;
      if (body.images !== undefined) updateData.images = body.images;
      if (body.isActive !== undefined) updateData.isActive = body.isActive;
      if (body.type !== undefined) updateData.type = body.type;
      if (body.ticketCount !== undefined) updateData.ticketCount = body.ticketCount;
      if (body.linkedCompetitionId !== undefined) {
        const lid = body.linkedCompetitionId;
        if (lid) {
          if (!Types.ObjectId.isValid(lid)) {
            return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid linked competition ID", 400);
          }
          const linked = await Competition.findById(lid).lean();
          if (!linked) {
            return error(c, ErrorCodes.NOT_FOUND, "Linked competition not found", 404);
          }
          if (linked.status !== "active") {
            return error(
              c,
              ErrorCodes.VALIDATION_ERROR,
              `Cannot link to a ${linked.status} competition`,
              400
            );
          }
          updateData.linkedCompetitionId = new Types.ObjectId(lid);
        } else {
          updateData.linkedCompetitionId = null;
        }
      }

      const updated = await BonusAward.findByIdAndUpdate(id, updateData, {
        returnDocument: "after",
      }).lean();

      if (!updated) {
        return error(c, ErrorCodes.NOT_FOUND, "Bonus award template not found", 404);
      }

      await invalidateByChannelSafe(
        CH.bonusAwardTemplates,
        CH.competitions,
        CH.competitionDetail,
        CH.landingPage
      );

      return success(c, formatBonusAward(updated as unknown as Record<string, unknown>));
    } catch (err: unknown) {
      console.error("Error updating bonus award template:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.bonusAwards.templates.update",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    const award = await BonusAward.findById(id).lean();
    if (!award) {
      return error(c, ErrorCodes.NOT_FOUND, "Bonus award template not found", 404);
    }

    if (award.deletedAt) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Template is already deleted", 400);
    }

    const activeAssignment = await CompetitionBonusAwardAssignment.exists({
      bonusAwardId: new Types.ObjectId(id),
      isArchived: false,
    });

    if (activeAssignment) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "Cannot delete a template that has active assignments",
        400
      );
    }

    const userId = c.get("userId");
    const updateData: Record<string, unknown> = { deletedAt: new Date() };
    if (userId) {
      updateData.deletedBy = new Types.ObjectId(userId);
    }

    await BonusAward.findByIdAndUpdate(id, updateData);

    await invalidateByChannelSafe(
      CH.bonusAwardTemplates,
      CH.competitions,
      CH.competitionDetail,
      CH.landingPage
    );

    return success(c, { success: true, deleted: true });
  } catch (err: unknown) {
    console.error("Error deleting bonus award template:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.bonusAwards.templates.delete",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/:id/restore", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    const award = await BonusAward.findById(id).lean();
    if (!award) {
      return error(c, ErrorCodes.NOT_FOUND, "Bonus award template not found", 404);
    }

    if (!award.deletedAt) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Template is not deleted", 400);
    }

    await BonusAward.findByIdAndUpdate(id, {
      deletedAt: null,
      deletedBy: null,
    });

    await invalidateByChannelSafe(
      CH.bonusAwardTemplates,
      CH.competitions,
      CH.competitionDetail,
      CH.landingPage
    );

    return success(c, { restored: true });
  } catch (err: unknown) {
    console.error("Error restoring bonus award template:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.bonusAwards.templates.restore",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export { app as adminBonusAwards };

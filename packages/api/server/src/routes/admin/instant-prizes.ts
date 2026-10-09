import { BonusAward, CompetitionInstantPrize, InstantPrize } from "@oc/api-db/models";
import type { IInstantPrize } from "@oc/api-db/models/InstantPrize";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { escapeRegex } from "@oc/api-infra/fuzzy-search";
import { applyGroupBy, type GroupByFieldConfig } from "@oc/api-infra/group-by";
import { parsePagination, parseSort } from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireManager } from "@oc/api-server/middleware/auth";
import {
  type CreateInstantPrizeInput,
  createInstantPrizeSchema,
  type UpdateInstantPrizeInput,
  updateInstantPrizeSchema,
  validateBody,
} from "@oc/api-validation";
import { Hono } from "hono";
import { PipelineStage, Types } from "mongoose";

const app = new Hono();

app.use("*", requireManager);

const CIP_COLLECTION = CompetitionInstantPrize.collection.name;
const BA_COLLECTION = BonusAward.collection.name;

async function invalidatePrizeRelatedCaches(): Promise<void> {
  // Template changes affect public instant-prizes lists and competition landing pages.
  await invalidateByChannelSafe(
    CH.competitions,
    CH.landingPage,
    CH.competitionDetail,
    CH.instantPrizes
  );
}

app.get("/", async (c) => {
  try {
    const { limit, page } = parsePagination(c);
    const groupBy = c.req.query("groupBy");
    const { sortObj, sortableFields, sortDir } = parseSort(c, {
      fields: ["title", "value", "isActive", "type", "createdAt"],
      defaultSort: { createdAt: -1 },
    });
    await dbConnect();

    const showDeleted = c.req.query("showDeleted") === "true";
    const query: Record<string, unknown> = {};
    if (!showDeleted) {
      query.deletedAt = null;
    }
    const isActive = c.req.query("isActive");
    if (isActive !== undefined) query.isActive = isActive === "true";

    const search = c.req.query("search")?.trim();
    if (search) {
      const safe = escapeRegex(search);
      query.$or = [
        { title: { $regex: safe, $options: "i" } },
        { description: { $regex: safe, $options: "i" } },
        { type: { $regex: safe, $options: "i" } },
      ];
    }

    const basePipeline: PipelineStage[] = [
      { $match: query },
      {
        $lookup: {
          from: CIP_COLLECTION,
          localField: "_id",
          foreignField: "instantPrizeId",
          as: "_cipAssignments",
        },
      },
      {
        $lookup: {
          from: BA_COLLECTION,
          localField: "_id",
          foreignField: "sourceInstantPrizeId",
          as: "_baReferences",
          pipeline: [{ $match: { deletedAt: null } }],
        },
      },
      {
        $lookup: {
          from: "competitions",
          localField: "linkedCompetitionId",
          foreignField: "_id",
          as: "_linkedComp",
        },
      },
      { $unwind: { path: "$_linkedComp", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          bonusAwardCount: { $size: "$_baReferences" },
          competitionAssignmentCount: { $size: "$_cipAssignments" },
          "linkedCompetition.title": "$_linkedComp.title",
          "linkedCompetition.imageUrl": "$_linkedComp.imageUrl",
          "linkedCompetition.status": "$_linkedComp.status",
        },
      },
    ];
    const baseCountPipeline: PipelineStage[] = [
      { $match: query },
      {
        $lookup: {
          from: CIP_COLLECTION,
          localField: "_id",
          foreignField: "instantPrizeId",
          as: "_cipAssignments",
        },
      },
      {
        $lookup: {
          from: BA_COLLECTION,
          localField: "_id",
          foreignField: "sourceInstantPrizeId",
          as: "_baReferences",
          pipeline: [{ $match: { deletedAt: null } }],
        },
      },
      {
        $addFields: {
          bonusAwardCount: { $size: "$_baReferences" },
          competitionAssignmentCount: { $size: "$_cipAssignments" },
        },
      },
    ];

    const GROUPING_CONFIG: Record<string, GroupByFieldConfig> = {
      type: { groupKey: "$type", groupLabel: "$type" },
    };

    const { dataPipeline, countPipeline } = applyGroupBy(
      basePipeline,
      baseCountPipeline,
      groupBy,
      GROUPING_CONFIG,
      page,
      limit,
      sortObj,
      sortDir
    );

    const [instantPrizes, totalResult] = await Promise.all([
      InstantPrize.aggregate(dataPipeline).option({ maxTimeMS: 5000 }).exec(),
      InstantPrize.aggregate(countPipeline).option({ maxTimeMS: 5000 }).exec(),
    ]);

    const total = totalResult.length > 0 ? (totalResult[0] as { total: number }).total : 0;

    return paginated(c, instantPrizes, total, page, limit, { sortableFields });
  } catch (err: unknown) {
    console.error("Error listing instant prize templates:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.instantPrizes.list",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/deleted", async (c) => {
  try {
    await dbConnect();
    const items = await InstantPrize.findDeleted().sort({ deletedAt: -1 }).limit(50).lean();
    return success(c, items);
  } catch (err: unknown) {
    console.error("Error listing deleted instant prizes:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.instantPrizes.listDeleted",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    if (!Types.ObjectId.isValid(id)) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid prize ID format", 400);
    }
    await dbConnect();

    const instantPrize = await InstantPrize.findById(id).lean();

    if (!instantPrize) {
      return error(c, ErrorCodes.NOT_FOUND, "Instant prize template not found", 404);
    }

    return success(c, instantPrize);
  } catch (err: unknown) {
    console.error("Error fetching instant prize template:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.instantPrizes.getOne",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post(
  "/",
  async (c, next) => validateBody(c, next, createInstantPrizeSchema),
  async (c) => {
    try {
      const body = c.get("body") as CreateInstantPrizeInput;
      await dbConnect();

      const title = (body.title ?? "").trim();
      if (!title) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "Title is required", 400);
      }

      const type = body.type;
      if (type !== undefined && type !== "prize" && type !== "competition_ticket") {
        return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid prize type", 400);
      }

      if (type === "competition_ticket") {
        const lid = body.linkedCompetitionId;
        if (!lid || !Types.ObjectId.isValid(lid)) {
          return error(
            c,
            ErrorCodes.VALIDATION_ERROR,
            "Linked competition is required for competition ticket prizes",
            400
          );
        }
        const linked = await (await import("@oc/api-db/models")).Competition.findById(
          lid
        ).lean();
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
      }

      if (body.value !== undefined) {
        const valueNum = Number(body.value);
        if (Number.isNaN(valueNum) || valueNum < 0) {
          return error(c, ErrorCodes.VALIDATION_ERROR, "Value must be a non-negative number", 400);
        }
      }

      if (type === "competition_ticket" && body.ticketCount !== undefined) {
        const tc = Number(body.ticketCount);
        if (!Number.isInteger(tc) || tc < 1) {
          return error(c, ErrorCodes.VALIDATION_ERROR, "Ticket count must be at least 1", 400);
        }
      }

      const prizeData: Record<string, unknown> = {
        title,
        description: body.description,
        images: Array.isArray(body.images) ? body.images : body.images ? [body.images] : [],
        value: body.value !== undefined ? Number(body.value) : undefined,
        isActive: body.isActive !== undefined ? body.isActive : true,
      };

      if (body.type !== undefined) prizeData.type = body.type;
      if (body.linkedCompetitionId !== undefined)
        prizeData.linkedCompetitionId = body.linkedCompetitionId;
      if (body.ticketCount !== undefined) prizeData.ticketCount = body.ticketCount;

      const prize = await InstantPrize.create(prizeData);

      await invalidatePrizeRelatedCaches();

      return success(c, prize);
    } catch (err: unknown) {
      console.error("Error creating instant prize template:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.instantPrizes.create",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.put(
  "/:id",
  async (c, next) => validateBody(c, next, updateInstantPrizeSchema),
  async (c) => {
    try {
      const id = c.req.param("id");
      if (!Types.ObjectId.isValid(id)) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid prize ID format", 400);
      }
      const body = c.get("body") as UpdateInstantPrizeInput;
      await dbConnect();

      if (body.title !== undefined) {
        const title = (body.title ?? "").trim();
        if (!title) {
          return error(c, ErrorCodes.VALIDATION_ERROR, "Title cannot be empty", 400);
        }
      }

      if (body.type !== undefined && body.type !== "prize" && body.type !== "competition_ticket") {
        return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid prize type", 400);
      }

      if (body.value !== undefined) {
        const valueNum = Number(body.value);
        if (Number.isNaN(valueNum) || valueNum < 0) {
          return error(c, ErrorCodes.VALIDATION_ERROR, "Value must be a non-negative number", 400);
        }
      }

      if (body.type === "competition_ticket" && body.linkedCompetitionId !== undefined) {
        const lid = body.linkedCompetitionId;
        if (!lid || !Types.ObjectId.isValid(lid)) {
          return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid linked competition ID", 400);
        }
        const linked = await (await import("@oc/api-db/models")).Competition.findById(
          lid
        ).lean();
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
      }

      if (body.ticketCount !== undefined) {
        const tc = Number(body.ticketCount);
        if (!Number.isInteger(tc) || tc < 1) {
          return error(c, ErrorCodes.VALIDATION_ERROR, "Ticket count must be at least 1", 400);
        }
      }

      const updateData: Record<string, unknown> = {};
      if (body.title !== undefined) updateData.title = body.title;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.images !== undefined) {
        updateData.images = Array.isArray(body.images) ? body.images : [body.images];
      }
      if (body.value !== undefined) updateData.value = Number(body.value);
      if (body.isActive !== undefined) updateData.isActive = body.isActive;
      if (body.type !== undefined) updateData.type = body.type;
      if (body.linkedCompetitionId !== undefined)
        updateData.linkedCompetitionId = body.linkedCompetitionId;
      if (body.ticketCount !== undefined) updateData.ticketCount = body.ticketCount;

      const instantPrize = await InstantPrize.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true }
      ).lean();

      if (!instantPrize) {
        return error(c, ErrorCodes.NOT_FOUND, "Instant prize template not found", 404);
      }

      await invalidateByChannelSafe(
        CH.competitions,
        CH.landingPage,
        CH.competitionDetail,
        CH.instantPrizes
      );
      return success(c, instantPrize);
    } catch (err: unknown) {
      console.error("Error updating instant prize template:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.instantPrizes.update",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    if (!Types.ObjectId.isValid(id)) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid prize ID format", 400);
    }
    await dbConnect();

    const hasAssignments = await CompetitionInstantPrize.exists({
      instantPrizeId: new Types.ObjectId(id),
    }).lean();
    if (hasAssignments) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "Cannot delete prize template that has competition assignments",
        400
      );
    }

    const hasBonusAwards = await BonusAward.exists({
      sourceInstantPrizeId: new Types.ObjectId(id),
      deletedAt: null,
    }).lean();
    if (hasBonusAwards) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "Cannot delete prize template that is used by bonus awards",
        400
      );
    }

    const instantPrize = await InstantPrize.softDelete(id, c.get("userId") ?? undefined);

    if (!instantPrize) {
      return error(c, ErrorCodes.NOT_FOUND, "Instant prize template not found", 404);
    }

    await invalidatePrizeRelatedCaches();
    return success(c, { success: true });
  } catch (err: unknown) {
    console.error("Error deleting instant prize template:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.instantPrizes.delete",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/templates", async (c) => {
  try {
    const body = await c.req.json();
    await dbConnect();

    const title = (body.title ?? "").trim();
    if (!title) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Title is required", 400);
    }

    const prizeType = body.prizeType;
    if (!prizeType || !["fixed", "percentage", "tiered"].includes(prizeType)) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "prizeType must be one of: fixed, percentage, tiered",
        400
      );
    }

    const prizeValue = Number(body.prizeValue);
    if (Number.isNaN(prizeValue) || prizeValue <= 0) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "prizeValue must be a positive number", 400);
    }

    const prizeData: Record<string, unknown> = {
      title,
      description: body.description ?? "",
      prizeType,
      prizeValue,
      isActive: body.isActive !== undefined ? body.isActive : true,
    };

    const prize = await InstantPrize.create(prizeData);

    await invalidatePrizeRelatedCaches();

    return success(c, prize);
  } catch (err: unknown) {
    console.error("Error creating instant prize template:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.instantPrizes.createTemplate",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.put("/templates/:id", async (c) => {
  try {
    const id = c.req.param("id");
    if (!Types.ObjectId.isValid(id)) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid prize ID format", 400);
    }
    const body = await c.req.json();
    await dbConnect();

    if (body.title !== undefined) {
      const title = (body.title ?? "").trim();
      if (!title) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "Title cannot be empty", 400);
      }
    }

    if (
      body.prizeType !== undefined &&
      !["fixed", "percentage", "tiered"].includes(body.prizeType)
    ) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "prizeType must be one of: fixed, percentage, tiered",
        400
      );
    }

    if (body.prizeValue !== undefined) {
      const prizeValue = Number(body.prizeValue);
      if (Number.isNaN(prizeValue) || prizeValue <= 0) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "prizeValue must be a positive number", 400);
      }
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = (body.title ?? "").trim();
    if (body.description !== undefined) updateData.description = body.description;
    if (body.prizeType !== undefined) updateData.prizeType = body.prizeType;
    if (body.prizeValue !== undefined) updateData.prizeValue = Number(body.prizeValue);
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const instantPrize = await InstantPrize.findByIdAndUpdate(
      id,
      updateData as Partial<IInstantPrize>,
      { returnDocument: "after" }
    ).lean();

    if (!instantPrize) {
      return error(c, ErrorCodes.NOT_FOUND, "Instant prize template not found", 404);
    }

    await invalidatePrizeRelatedCaches();

    return success(c, instantPrize);
  } catch (err: unknown) {
    console.error("Error updating instant prize template:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.instantPrizes.updateTemplate",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.delete("/templates/:id", async (c) => {
  try {
    const id = c.req.param("id");
    if (!Types.ObjectId.isValid(id)) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid prize ID format", 400);
    }
    await dbConnect();

    const hasAssignments = await CompetitionInstantPrize.exists({
      instantPrizeId: new Types.ObjectId(id),
    }).lean();
    if (hasAssignments) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "Cannot delete prize template that is linked to an active competition",
        400
      );
    }

    const hasBonusAwards = await BonusAward.exists({
      sourceInstantPrizeId: new Types.ObjectId(id),
      deletedAt: null,
    }).lean();
    if (hasBonusAwards) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "Cannot delete prize template that is used by bonus awards",
        400
      );
    }

    const instantPrize = await InstantPrize.softDelete(id, c.get("userId") ?? undefined);

    if (!instantPrize) {
      return error(c, ErrorCodes.NOT_FOUND, "Instant prize template not found", 404);
    }

    await invalidatePrizeRelatedCaches();
    return success(c, { success: true });
  } catch (err: unknown) {
    console.error("Error deleting instant prize template:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.instantPrizes.deleteTemplate",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/:id/restore", async (c) => {
  try {
    const id = c.req.param("id");
    if (!Types.ObjectId.isValid(id)) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid prize ID format", 400);
    }
    await dbConnect();
    const restored = await InstantPrize.restore(id);
    if (!restored) {
      return error(c, ErrorCodes.NOT_FOUND, "Instant prize template not found", 404);
    }
    await invalidatePrizeRelatedCaches();
    return success(c, { restored: true });
  } catch (err: unknown) {
    console.error("Error restoring instant prize template:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.instantPrizes.restore",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;

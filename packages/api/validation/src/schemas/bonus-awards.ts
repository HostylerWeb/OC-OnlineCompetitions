import { z } from "zod";
import { idSchema } from "./common";
import { instantPrizeCategorySchema } from "./instant-prizes";

// ─── Template schemas ─────────────────────────────────────────────────────────

export const createBonusAwardSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  value: z.number().min(0).optional(),
  images: z.array(z.string().url()).max(20).default([]),
  isActive: z.boolean().default(true),
  type: z.enum(["prize", "competition_ticket"]).default("prize"),
  prizeCategory: instantPrizeCategorySchema.optional(),
  linkedCompetitionId: idSchema.optional(),
  ticketCount: z.number().int().min(1).max(10000).optional(),
  sourceInstantPrizeId: idSchema.optional(),
});

export const updateBonusAwardSchema = z
  .object({
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(2000).optional(),
    value: z.number().min(0).optional(),
    images: z.array(z.string().url()).max(20).optional(),
    isActive: z.boolean().optional(),
    type: z.enum(["prize", "competition_ticket"]).optional(),
    prizeCategory: instantPrizeCategorySchema.optional().nullable(),
    linkedCompetitionId: idSchema.optional().nullable(),
    ticketCount: z.number().int().min(1).max(10000).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

// ─── Assignment schemas ──────────────────────────────────────────────────────

export const createAssignmentSchema = z.object({
  bonusAwardId: idSchema,
  milestonePct: z.number().int().min(1).max(99),
  quantity: z.number().int().min(1).max(100).default(1),
});

export const updateAssignmentSchema = z
  .object({
    milestonePct: z.number().int().min(1).max(99).optional(),
    quantity: z.number().int().min(1).max(100).optional(),
    isArchived: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.milestonePct !== undefined ||
      data.quantity !== undefined ||
      data.isArchived !== undefined,
    { message: "At least one field (milestonePct, quantity, isArchived) must be provided" }
  );

// ─── Query schemas ────────────────────────────────────────────────────────────

export const bonusAwardCapacityQuerySchema = z.object({
  excludeAssignmentId: idSchema.optional(),
});

export const bonusAwardWinsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortField: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  competitionId: idSchema.optional(),
  assignmentId: idSchema.optional(),
  bonusAwardId: idSchema.optional(),
  claimed: z.enum(["true", "false"]).optional(),
  showDeleted: z.coerce.boolean().optional(),
  wonAtFrom: z.string().optional(),
  wonAtTo: z.string().optional(),
});

export const bonusAwardWinClaimSchema = z.object({
  claimed: z.boolean(),
});

export const bonusAwardWinBulkSchema = z.object({
  action: z.enum(["claim", "unclaim", "delete"]),
  ids: z.array(idSchema).min(1).max(100),
});

// ─── Type exports ─────────────────────────────────────────────────────────────

export type CreateBonusAwardInput = z.infer<typeof createBonusAwardSchema>;
export type UpdateBonusAwardInput = z.infer<typeof updateBonusAwardSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type BonusAwardCapacityQueryInput = z.infer<typeof bonusAwardCapacityQuerySchema>;
export type BonusAwardWinsQueryInput = z.infer<typeof bonusAwardWinsQuerySchema>;
export type BonusAwardWinClaimInput = z.infer<typeof bonusAwardWinClaimSchema>;
export type BonusAwardWinBulkInput = z.infer<typeof bonusAwardWinBulkSchema>;

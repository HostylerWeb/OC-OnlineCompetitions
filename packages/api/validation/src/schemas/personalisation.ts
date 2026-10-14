import { z } from "zod";

export const personalisationActionSchema = z.enum([
  "none",
  "upsell_popup",
  "competition_highlight",
  "ticket_bundle_suggestion",
]);

export const personalisationSurfaceSchema = z.enum(["home", "competition", "checkout"]);

export const personalisationPlanPayloadSchema = z.object({
  competitionId: z.string().max(64).optional(),
  headline: z.string().max(200).optional(),
  body: z.string().max(1000).optional(),
  suggestedTicketCount: z.number().int().min(1).max(100).optional(),
  ctaLabel: z.string().max(80).optional(),
});

export const personalisationBatchItemSchema = z.object({
  userId: z.string().min(1).max(64),
  action: personalisationActionSchema,
  surfaces: z.array(personalisationSurfaceSchema).max(3).optional(),
  payload: personalisationPlanPayloadSchema.optional(),
});

export const personalisationBatchResponseSchema = z.object({
  plans: z.array(personalisationBatchItemSchema),
});

export const personalisationServeQuerySchema = z.object({
  surface: personalisationSurfaceSchema,
});

export const personalisationAckSchema = z.object({
  surface: personalisationSurfaceSchema,
  event: z.enum(["shown", "dismissed", "clicked"]),
  action: personalisationActionSchema,
});

export type PersonalisationBatchItem = z.infer<typeof personalisationBatchItemSchema>;

import { randomUUID } from "node:crypto";
import {
  AiPersonalisationSettings,
  PersonalisationPlannerRun,
  UserPersonalisationFeatures,
  UserPersonalisationPlan,
} from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import {
  DEFAULT_AI_PERSONALISATION_SETTINGS,
  PERSONALISATION_PROMPT_VERSION,
  type AiPersonalisationSettings as AiSettings,
  type UserPersonalisationFeatureSnapshot,
} from "@oc/types";
import { planPersonalisationBatch } from "@oc/api-server/lib/openrouter/plan-personalisation-batch";
import { buildPersonalisationCatalogueSnapshot } from "@oc/api-server/lib/personalisation/build-catalogue-snapshot";
import { rebuildPersonalisationFeatures } from "@oc/api-server/lib/personalisation/rebuild-features";

export type RunPersonalisationPlannerSummary = {
  runId: string;
  status: "completed" | "failed" | "skipped";
  usersEligible: number;
  usersPlanned: number;
  llmBatches: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCostUsd: number;
  dryRun: boolean;
  runErrors: string[];
};

function mergeSettings(raw: AiSettings | null): AiSettings {
  if (!raw) return DEFAULT_AI_PERSONALISATION_SETTINGS;
  return { ...DEFAULT_AI_PERSONALISATION_SETTINGS, ...raw };
}

function defaultSurfacesForAction(
  action: string
): ("home" | "competition" | "checkout")[] {
  if (action === "ticket_bundle_suggestion") return ["checkout"];
  if (action === "competition_highlight") return ["home", "competition"];
  if (action === "upsell_popup") return ["home", "competition", "checkout"];
  return [];
}

type FeatureRow = {
  userId: string;
  totalSpent?: number;
  totalEntries?: number;
  topCategorySlugs?: string[];
  lastOrderAt?: Date | string;
  walletBalanceBand?: UserPersonalisationFeatureSnapshot["walletBalanceBand"];
  referralBand?: "none" | "active";
  marketingConsent?: boolean;
  selfExcluded?: boolean;
  selfExcludedUntil?: Date | string | null;
  hasActiveSpendLimit?: boolean;
  isGuestCheckout?: boolean;
};

function featureRowsToSnapshots(rows: FeatureRow[]): UserPersonalisationFeatureSnapshot[] {
  return rows.map((row) => ({
    userId: String(row.userId),
    totalSpent: Number(row.totalSpent ?? 0),
    totalEntries: Number(row.totalEntries ?? 0),
    topCategorySlugs: row.topCategorySlugs ?? [],
    lastOrderAt: row.lastOrderAt ? String(row.lastOrderAt) : undefined,
    walletBalanceBand: row.walletBalanceBand ?? "zero",
    referralBand: row.referralBand ?? "none",
    marketingConsent: Boolean(row.marketingConsent),
    selfExcluded: Boolean(row.selfExcluded),
    selfExcludedUntil: row.selfExcludedUntil ? String(row.selfExcludedUntil) : null,
    hasActiveSpendLimit: Boolean(row.hasActiveSpendLimit),
    isGuestCheckout: Boolean(row.isGuestCheckout),
    eligibleForLlm: true,
  }));
}

export async function runPersonalisationPlanner(): Promise<RunPersonalisationPlannerSummary> {
  await dbConnect();
  const settingsDoc = await AiPersonalisationSettings.findById("ai_personalisation_settings").lean();
  const settings = mergeSettings(settingsDoc as AiSettings | null);

  const runId = randomUUID();
  const errors: string[] = [];

  if (!settings.plannerEnabled) {
    await PersonalisationPlannerRun.create({
      runId,
      startedAt: new Date(),
      completedAt: new Date(),
      status: "skipped",
      usersEligible: 0,
      usersPlanned: 0,
      dryRun: settings.dryRunPlanner,
      runErrors: ["planner_disabled"],
      settingsSnapshot: settings,
    });
    return {
      runId,
      status: "skipped",
      usersEligible: 0,
      usersPlanned: 0,
      llmBatches: 0,
      tokensIn: 0,
      tokensOut: 0,
      estimatedCostUsd: 0,
      dryRun: settings.dryRunPlanner,
      runErrors: ["planner_disabled"],
    };
  }

  const apiKey = settings.openRouterApiKey?.trim();
  if (!apiKey && !settings.dryRunPlanner) {
    await PersonalisationPlannerRun.create({
      runId,
      startedAt: new Date(),
      completedAt: new Date(),
      status: "failed",
      runErrors: ["missing_api_key"],
      settingsSnapshot: settings,
      dryRun: false,
    });
    return {
      runId,
      status: "failed",
      usersEligible: 0,
      usersPlanned: 0,
      llmBatches: 0,
      tokensIn: 0,
      tokensOut: 0,
      estimatedCostUsd: 0,
      dryRun: false,
      runErrors: ["missing_api_key"],
    };
  }

  await PersonalisationPlannerRun.create({
    runId,
    startedAt: new Date(),
    status: "running",
    dryRun: settings.dryRunPlanner,
    settingsSnapshot: settings,
  });

  let usersEligible = 0;
  let usersPlanned = 0;
  let llmBatches = 0;
  let tokensIn = 0;
  let tokensOut = 0;

  try {
    const featureSummary = await rebuildPersonalisationFeatures({ runId, settings });
    usersEligible = featureSummary.llmEligibleCount;

    const validFrom = new Date();
    const validUntil = new Date(
      validFrom.getTime() + settings.plannerIntervalHours * 60 * 60 * 1000
    );

    if (settings.dryRunPlanner) {
      await PersonalisationPlannerRun.updateOne(
        { runId },
        {
          $set: {
            status: "completed",
            completedAt: new Date(),
            usersEligible,
            usersPlanned: 0,
            llmBatches: 0,
            tokensIn: 0,
            tokensOut: 0,
            estimatedCostUsd: 0,
            runErrors: errors,
          },
        }
      );
      return {
        runId,
        status: "completed",
        usersEligible,
        usersPlanned: 0,
        llmBatches: 0,
        tokensIn: 0,
        tokensOut: 0,
        estimatedCostUsd: 0,
        dryRun: true,
        runErrors: errors,
      };
    }

    const catalogue = await buildPersonalisationCatalogueSnapshot();
    if (catalogue.length === 0) {
      errors.push("empty_catalogue");
    }

    const batchSize = Math.max(1, settings.usersPerLlmBatch);
    const featureRows = await UserPersonalisationFeatures.find({
      runId,
      eligibleForLlm: true,
    })
      .select("-__v")
      .lean<FeatureRow[]>();

    const writeNonePlans = async (rows: FeatureRow[], model: string) => {
      if (rows.length === 0) return;
      const noneOps = rows.map((row) => ({
        updateOne: {
          filter: { userId: String(row.userId) },
          update: {
            $set: {
              userId: String(row.userId),
              runId,
              planVersion: 1,
              action: "none",
              payload: {},
              surfaces: [],
              validFrom,
              validUntil,
              model,
              promptVersion: PERSONALISATION_PROMPT_VERSION,
            },
          },
          upsert: true,
        },
      }));
      await UserPersonalisationPlan.bulkWrite(noneOps);
      usersPlanned += rows.length;
    };

    for (let offset = 0; offset < featureRows.length; offset += batchSize) {
      if (llmBatches >= settings.maxLlmBatchesPerRun) break;

      const batch = featureRows.slice(offset, offset + batchSize);
      const users = featureRowsToSnapshots(batch);
      llmBatches += 1;

      try {
        const result = await planPersonalisationBatch({
          apiKey: apiKey!,
          settings,
          catalogue,
          users,
        });

        tokensIn += result.tokensIn;
        tokensOut += result.tokensOut;

        const planOps = result.plans.map((plan) => ({
          updateOne: {
            filter: { userId: plan.userId },
            update: {
              $set: {
                userId: plan.userId,
                runId,
                planVersion: 1,
                action: plan.action,
                payload: plan.payload ?? {},
                surfaces: plan.surfaces?.length
                  ? plan.surfaces
                  : defaultSurfacesForAction(plan.action),
                validFrom,
                validUntil,
                model: result.model,
                promptVersion: PERSONALISATION_PROMPT_VERSION,
              },
            },
            upsert: true,
          },
        }));

        if (planOps.length > 0) {
          await UserPersonalisationPlan.bulkWrite(planOps);
          usersPlanned += planOps.length;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`batch_failed:${msg.slice(0, 500)}`);
        await writeNonePlans(batch, settings.model);
      }
    }

    const estimatedCostUsd = (tokensIn / 1_000_000) * 0.15 + (tokensOut / 1_000_000) * 0.6;

    await PersonalisationPlannerRun.updateOne(
      { runId },
      {
        $set: {
          status: errors.length > 0 ? "completed" : "completed",
          completedAt: new Date(),
          usersEligible,
          usersPlanned,
          llmBatches,
          tokensIn,
          tokensOut,
          estimatedCostUsd,
          runErrors: errors,
        },
      }
    );

    return {
      runId,
      status: "completed",
      usersEligible,
      usersPlanned,
      llmBatches,
      tokensIn,
      tokensOut,
      estimatedCostUsd,
      dryRun: false,
      runErrors: errors,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
    await PersonalisationPlannerRun.updateOne(
      { runId },
      {
        $set: {
          status: "failed",
          completedAt: new Date(),
          usersEligible,
          usersPlanned,
          llmBatches,
          tokensIn,
          tokensOut,
          runErrors: errors,
        },
      }
    );
    return {
      runId,
      status: "failed",
      usersEligible,
      usersPlanned,
      llmBatches,
      tokensIn,
      tokensOut,
      estimatedCostUsd: 0,
      dryRun: settings.dryRunPlanner,
      runErrors: errors,
    };
  }
}

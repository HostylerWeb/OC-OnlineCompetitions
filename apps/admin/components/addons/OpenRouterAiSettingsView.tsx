"use client";

import { PageShell } from "@/components/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdminAiPersonalisationSettings,
  useAdminAiPersonalisationSettingsMutations,
  useAdminOpenRouterModelsScan,
  useAdminPersonalisationPlannerLatestRun,
  useAdminRunPersonalisationPlanner,
} from "@oc/api-admin";
import {
  DEFAULT_AI_PERSONALISATION_SETTINGS,
  partitionOpenRouterModelsWithRecommendations,
  type AiPersonalisationSettings,
  type OpenRouterModelListItem,
  type OpenRouterModelPricingTier,
  type PersonalisationAudienceMode,
} from "@oc/types";
import {
  ArrowDown,
  ArrowUp,
  Info,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Ticket,
  Wand2,
} from "@oc/icons";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "enthusiastic", label: "Enthusiastic" },
] as const;

const usdPerMillionFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

function formatUsdPerMillionTokens(pricePerToken: number): string {
  const perMillion = pricePerToken * 1_000_000;
  if (!Number.isFinite(perMillion) || perMillion === 0) {
    return usdPerMillionFormatter.format(0);
  }
  return usdPerMillionFormatter.format(perMillion);
}

function ModelPricingHint({ inputUsd, outputUsd }: { inputUsd: string; outputUsd: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums text-muted-foreground">
      <span className="inline-flex items-center gap-0.5">
        <ArrowDown className="size-3 shrink-0" aria-hidden />
        {inputUsd}
      </span>
      <span className="text-border">·</span>
      <span className="inline-flex items-center gap-0.5">
        <ArrowUp className="size-3 shrink-0" aria-hidden />
        {outputUsd}
      </span>
    </span>
  );
}

function ModelSelectOption({
  opt,
  pricingTier,
  suggested,
}: {
  opt: OpenRouterModelListItem;
  pricingTier: OpenRouterModelPricingTier | "";
  suggested?: boolean;
}) {
  const inputUsd = formatUsdPerMillionTokens(opt.promptPricePerToken);
  const outputUsd = formatUsdPerMillionTokens(opt.completionPricePerToken);
  const showPaidPricing = pricingTier === "paid" && !opt.isFree;

  return (
    <SelectItem value={opt.id}>
      <span className="flex w-full min-w-0 items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 truncate">
          {suggested ? (
            <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px] font-medium">
              Suggested
            </Badge>
          ) : null}
          <span className="truncate">{opt.name}</span>
        </span>
        {showPaidPricing ? (
          <ModelPricingHint inputUsd={inputUsd} outputUsd={outputUsd} />
        ) : opt.isFree ? (
          <span className="shrink-0 text-xs text-muted-foreground">Free</span>
        ) : null}
      </span>
    </SelectItem>
  );
}

function SettingRow({
  title,
  description,
  control,
}: {
  title: string;
  description?: string;
  control: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/60 py-4 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-xl">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function applySettingsToForm(
  settings: AiPersonalisationSettings,
  setters: {
    setAddonEnabled: (v: boolean) => void;
    setApiKey: (v: string) => void;
    setModel: (v: string) => void;
    setTone: (v: string) => void;
    setUpsellPopup: (v: boolean) => void;
    setUpsellPopupCooldownHours: (v: string) => void;
    setCompetitionHighlight: (v: boolean) => void;
    setCompetitionHighlightCooldownHours: (v: string) => void;
    setTicketBundleSuggestion: (v: boolean) => void;
    setTicketBundleSuggestionCooldownHours: (v: string) => void;
    setRespectSpendLimits: (v: boolean) => void;
    setBrandInstructions: (v: string) => void;
    setPlannerEnabled: (v: boolean) => void;
    setPlannerIntervalHours: (v: string) => void;
    setAudienceMode: (v: PersonalisationAudienceMode) => void;
    setAudienceOrdersWithinDays: (v: string) => void;
    setAudienceActivityWithinDays: (v: string) => void;
    setRequireMarketingConsent: (v: boolean) => void;
    setMaxUsersPerRun: (v: string) => void;
    setMaxLlmBatchesPerRun: (v: string) => void;
    setUsersPerLlmBatch: (v: string) => void;
    setMaxOutputTokensPerBatch: (v: string) => void;
    setPlannerModel: (v: string) => void;
    setDryRunPlanner: (v: boolean) => void;
  }
) {
  setters.setAddonEnabled(settings.addonEnabled);
  setters.setApiKey(settings.openRouterApiKey);
  setters.setModel(settings.model);
  setters.setTone(settings.tone);
  setters.setUpsellPopup(settings.upsellPopup);
  setters.setUpsellPopupCooldownHours(String(settings.upsellPopupCooldownHours));
  setters.setCompetitionHighlight(settings.competitionHighlight);
  setters.setCompetitionHighlightCooldownHours(String(settings.competitionHighlightCooldownHours));
  setters.setTicketBundleSuggestion(settings.ticketBundleSuggestion);
  setters.setTicketBundleSuggestionCooldownHours(String(settings.ticketBundleSuggestionCooldownHours));
  setters.setRespectSpendLimits(settings.respectSpendLimits);
  setters.setBrandInstructions(settings.brandInstructions);
  setters.setPlannerEnabled(settings.plannerEnabled);
  setters.setPlannerIntervalHours(String(settings.plannerIntervalHours));
  setters.setAudienceMode(settings.audienceMode);
  setters.setAudienceOrdersWithinDays(String(settings.audienceOrdersWithinDays));
  setters.setAudienceActivityWithinDays(String(settings.audienceActivityWithinDays));
  setters.setRequireMarketingConsent(settings.requireMarketingConsent);
  setters.setMaxUsersPerRun(String(settings.maxUsersPerRun));
  setters.setMaxLlmBatchesPerRun(String(settings.maxLlmBatchesPerRun));
  setters.setUsersPerLlmBatch(String(settings.usersPerLlmBatch));
  setters.setMaxOutputTokensPerBatch(String(settings.maxOutputTokensPerBatch));
  setters.setPlannerModel(settings.plannerModel);
  setters.setDryRunPlanner(settings.dryRunPlanner);
}

export function OpenRouterAiSettingsView({ embedded = false }: { embedded?: boolean }) {
  const { data, isLoading, isError } = useAdminAiPersonalisationSettings();
  const { saveSettingsMutation } = useAdminAiPersonalisationSettingsMutations();
  const scanModelsMutation = useAdminOpenRouterModelsScan();
  const { data: latestRunData } = useAdminPersonalisationPlannerLatestRun();
  const runPlannerMutation = useAdminRunPersonalisationPlanner();

  const [addonEnabled, setAddonEnabled] = useState(DEFAULT_AI_PERSONALISATION_SETTINGS.addonEnabled);
  const [apiKey, setApiKey] = useState(DEFAULT_AI_PERSONALISATION_SETTINGS.openRouterApiKey);
  const [model, setModel] = useState(DEFAULT_AI_PERSONALISATION_SETTINGS.model);
  const [tone, setTone] = useState(DEFAULT_AI_PERSONALISATION_SETTINGS.tone);
  const [upsellPopup, setUpsellPopup] = useState(DEFAULT_AI_PERSONALISATION_SETTINGS.upsellPopup);
  const [upsellPopupCooldownHours, setUpsellPopupCooldownHours] = useState(
    String(DEFAULT_AI_PERSONALISATION_SETTINGS.upsellPopupCooldownHours)
  );
  const [competitionHighlight, setCompetitionHighlight] = useState(
    DEFAULT_AI_PERSONALISATION_SETTINGS.competitionHighlight
  );
  const [competitionHighlightCooldownHours, setCompetitionHighlightCooldownHours] = useState(
    String(DEFAULT_AI_PERSONALISATION_SETTINGS.competitionHighlightCooldownHours)
  );
  const [ticketBundleSuggestion, setTicketBundleSuggestion] = useState(
    DEFAULT_AI_PERSONALISATION_SETTINGS.ticketBundleSuggestion
  );
  const [ticketBundleSuggestionCooldownHours, setTicketBundleSuggestionCooldownHours] = useState(
    String(DEFAULT_AI_PERSONALISATION_SETTINGS.ticketBundleSuggestionCooldownHours)
  );
  const [respectSpendLimits, setRespectSpendLimits] = useState(
    DEFAULT_AI_PERSONALISATION_SETTINGS.respectSpendLimits
  );
  const [brandInstructions, setBrandInstructions] = useState(
    DEFAULT_AI_PERSONALISATION_SETTINGS.brandInstructions
  );
  const [hydrated, setHydrated] = useState(false);
  const [pricingTier, setPricingTier] = useState<OpenRouterModelPricingTier | "">("");
  const [scannedModels, setScannedModels] = useState<OpenRouterModelListItem[]>([]);
  const [modelsScannedAt, setModelsScannedAt] = useState<string | null>(null);
  const [plannerEnabled, setPlannerEnabled] = useState(
    DEFAULT_AI_PERSONALISATION_SETTINGS.plannerEnabled
  );
  const [plannerIntervalHours, setPlannerIntervalHours] = useState(
    String(DEFAULT_AI_PERSONALISATION_SETTINGS.plannerIntervalHours)
  );
  const [audienceMode, setAudienceMode] = useState<PersonalisationAudienceMode>(
    DEFAULT_AI_PERSONALISATION_SETTINGS.audienceMode
  );
  const [audienceOrdersWithinDays, setAudienceOrdersWithinDays] = useState(
    String(DEFAULT_AI_PERSONALISATION_SETTINGS.audienceOrdersWithinDays)
  );
  const [audienceActivityWithinDays, setAudienceActivityWithinDays] = useState(
    String(DEFAULT_AI_PERSONALISATION_SETTINGS.audienceActivityWithinDays)
  );
  const [requireMarketingConsent, setRequireMarketingConsent] = useState(
    DEFAULT_AI_PERSONALISATION_SETTINGS.requireMarketingConsent
  );
  const [maxUsersPerRun, setMaxUsersPerRun] = useState(
    String(DEFAULT_AI_PERSONALISATION_SETTINGS.maxUsersPerRun)
  );
  const [maxLlmBatchesPerRun, setMaxLlmBatchesPerRun] = useState(
    String(DEFAULT_AI_PERSONALISATION_SETTINGS.maxLlmBatchesPerRun)
  );
  const [usersPerLlmBatch, setUsersPerLlmBatch] = useState(
    String(DEFAULT_AI_PERSONALISATION_SETTINGS.usersPerLlmBatch)
  );
  const [maxOutputTokensPerBatch, setMaxOutputTokensPerBatch] = useState(
    String(DEFAULT_AI_PERSONALISATION_SETTINGS.maxOutputTokensPerBatch)
  );
  const [plannerModel, setPlannerModel] = useState(
    DEFAULT_AI_PERSONALISATION_SETTINGS.plannerModel
  );
  const [dryRunPlanner, setDryRunPlanner] = useState(
    DEFAULT_AI_PERSONALISATION_SETTINGS.dryRunPlanner
  );

  const formSetters = {
    setAddonEnabled,
    setApiKey,
    setModel,
    setTone,
    setUpsellPopup,
    setUpsellPopupCooldownHours,
    setCompetitionHighlight,
    setCompetitionHighlightCooldownHours,
    setTicketBundleSuggestion,
    setTicketBundleSuggestionCooldownHours,
    setRespectSpendLimits,
    setBrandInstructions,
    setPlannerEnabled,
    setPlannerIntervalHours,
    setAudienceMode,
    setAudienceOrdersWithinDays,
    setAudienceActivityWithinDays,
    setRequireMarketingConsent,
    setMaxUsersPerRun,
    setMaxLlmBatchesPerRun,
    setUsersPerLlmBatch,
    setMaxOutputTokensPerBatch,
    setPlannerModel,
    setDryRunPlanner,
  };

  useEffect(() => {
    if (!data?.data || hydrated) return;
    applySettingsToForm(data.data, formSetters);
    setHydrated(true);
  }, [data?.data, hydrated]);

  function resetDefaults() {
    if (data?.data) {
      applySettingsToForm(data.data, formSetters);
      toast.message("Reverted to last saved settings.");
      return;
    }
    applySettingsToForm(DEFAULT_AI_PERSONALISATION_SETTINGS, formSetters);
    toast.message("Reset to defaults.");
  }

  const resolvedApiKey = apiKey.trim() || data?.data?.openRouterApiKey?.trim() || "";

  async function scanModels() {
    if (!pricingTier) {
      toast.error("Choose free or paid models first.");
      return;
    }
    if (!resolvedApiKey) {
      toast.error("Enter and save your OpenRouter API key before scanning.");
      return;
    }

    try {
      const res = await scanModelsMutation.mutateAsync({
        tier: pricingTier,
        openRouterApiKey: apiKey.trim() || undefined,
      });
      const list = res.data?.models ?? [];
      setScannedModels(list);
      setModelsScannedAt(res.data?.scannedAt ?? null);
      if (list.length === 0) {
        toast.message(`No ${pricingTier} text models found on your account.`);
        return;
      }
      if (!list.some((m) => m.id === model)) {
        setModel(list[0]!.id);
      }
      toast.success(`Found ${list.length} ${pricingTier} model${list.length === 1 ? "" : "s"}.`);
    } catch {
      toast.error("Could not load models from OpenRouter. Check your API key.");
    }
  }

  const modelSelectOptions = scannedModels;
  const { recommendedModelOptions, otherModelOptions } = useMemo(() => {
    if (pricingTier !== "paid" || modelSelectOptions.length === 0) {
      return { recommendedModelOptions: [], otherModelOptions: modelSelectOptions };
    }
    const { recommended, other } = partitionOpenRouterModelsWithRecommendations(modelSelectOptions);
    return { recommendedModelOptions: recommended, otherModelOptions: other };
  }, [modelSelectOptions, pricingTier]);

  const savedModelMissingFromScan =
    model && modelSelectOptions.length > 0 && !modelSelectOptions.some((m) => m.id === model);

  async function handleSave() {
    const resolvedModel =
      model.trim() ||
      data?.data?.model.trim() ||
      DEFAULT_AI_PERSONALISATION_SETTINGS.model;

    try {
      const res = await saveSettingsMutation.mutateAsync({
        addonEnabled,
        openRouterApiKey: apiKey.trim() || undefined,
        model: resolvedModel,
        tone: tone as AiPersonalisationSettings["tone"],
        upsellPopup,
        upsellPopupCooldownHours: Number.parseInt(upsellPopupCooldownHours, 10) || 24,
        competitionHighlight,
        competitionHighlightCooldownHours:
          Number.parseInt(competitionHighlightCooldownHours, 10) || 24,
        ticketBundleSuggestion,
        ticketBundleSuggestionCooldownHours:
          Number.parseInt(ticketBundleSuggestionCooldownHours, 10) || 24,
        respectSpendLimits,
        brandInstructions,
        plannerEnabled,
        plannerIntervalHours: Number.parseInt(plannerIntervalHours, 10) || 24,
        audienceMode,
        audienceOrdersWithinDays: Number.parseInt(audienceOrdersWithinDays, 10) || 90,
        audienceActivityWithinDays: Number.parseInt(audienceActivityWithinDays, 10) || 30,
        requireMarketingConsent,
        maxUsersPerRun: Number.parseInt(maxUsersPerRun, 10) || 5000,
        maxLlmBatchesPerRun: Number.parseInt(maxLlmBatchesPerRun, 10) || 250,
        usersPerLlmBatch: Number.parseInt(usersPerLlmBatch, 10) || 20,
        maxOutputTokensPerBatch: Number.parseInt(maxOutputTokensPerBatch, 10) || 2000,
        plannerModel,
        dryRunPlanner,
      });
      if (res.data) {
        applySettingsToForm(res.data, formSetters);
      }
      toast.success("AI personalisation settings saved.");
    } catch {
      toast.error("Could not save settings. Try again.");
    }
  }

  const saveActions = (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={resetDefaults} disabled={isLoading}>
        <RotateCcw className="size-4" />
        Reset
      </Button>
      <Button
        type="button"
        onClick={handleSave}
        disabled={isLoading || !hydrated || saveSettingsMutation.isPending}
      >
        <Save className="size-4" />
        Save
      </Button>
    </div>
  );

  const content = (
      <div className="flex flex-col gap-6">
        {isError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load settings</AlertTitle>
            <AlertDescription>Refresh the page or try again in a moment.</AlertDescription>
          </Alert>
        ) : null}
        <Alert>
          <Info className="size-4" />
          <AlertTitle>Daily batch planner</AlertTitle>
          <AlertDescription>
            The storefront reads precomputed plans from the database. Enable the daily planner and
            storefront addon, then run the planner on a schedule (cron) or manually below.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">OpenRouter connection</CardTitle>
              <Badge variant="outline">OpenRouter</Badge>
            </div>
            <CardDescription>
              Use your own OpenRouter API key and choose which model evaluates customer context on
              the server before the storefront shows a prompt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingRow
              title="Enable AI personalisation"
              description="When on, the backend will be allowed to call OpenRouter and trigger approved customer-facing actions."
              control={
                <Switch
                  id="ai-addon-enabled"
                  checked={addonEnabled}
                  onCheckedChange={setAddonEnabled}
                />
              }
            />
            <SettingRow
              title="API key"
              description="Stored securely on the server only (not shown to customers)."
              control={
                <Input
                  id="openrouter-api-key"
                  type="password"
                  autoComplete="off"
                  placeholder="sk-or-…"
                  className="w-full min-w-[16rem] sm:w-72"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={!addonEnabled}
                />
              }
            />
            <div className="border-b border-border/60 py-4 space-y-4">
              <div className="max-w-xl">
                <p className="text-sm font-medium text-foreground">Model</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose free or paid, scan live from OpenRouter, then pick a model from the list.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Pricing</Label>
                  <Select
                    value={pricingTier}
                    onValueChange={(v) => {
                      setPricingTier(v as OpenRouterModelPricingTier);
                      setScannedModels([]);
                      setModelsScannedAt(null);
                    }}
                    disabled={!addonEnabled}
                  >
                    <SelectTrigger className="w-full min-w-[10rem] sm:w-40">
                      <SelectValue placeholder="Free or paid" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free models</SelectItem>
                      <SelectItem value="paid">Paid models</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={scanModels}
                  disabled={!addonEnabled || !pricingTier || scanModelsMutation.isPending}
                >
                  {scanModelsMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Scan models
                </Button>
                <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-md">
                  {pricingTier === "paid" && modelSelectOptions.length > 0 ? (
                    <div
                      className="flex gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
                      role="note"
                    >
                      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      <span>
                        <ArrowDown className="inline size-3 align-text-bottom" aria-hidden /> means
                        input,{" "}
                        <ArrowUp className="inline size-3 align-text-bottom" aria-hidden /> means
                        output. The price is per 1 million tokens.
                      </span>
                    </div>
                  ) : null}
                  <Label className="text-xs text-muted-foreground">Available model</Label>
                  <Select
                    value={model}
                    onValueChange={setModel}
                    disabled={!addonEnabled || modelSelectOptions.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          modelSelectOptions.length === 0
                            ? "Scan to load models"
                            : "Select model"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {savedModelMissingFromScan ? (
                        <SelectItem value={model}>Saved: {model}</SelectItem>
                      ) : null}
                      {recommendedModelOptions.length > 0 ? (
                        <SelectGroup>
                          <SelectLabel>Suggested for storefront personalisation</SelectLabel>
                          {recommendedModelOptions.map((opt) => (
                            <ModelSelectOption
                              key={opt.id}
                              opt={opt}
                              pricingTier={pricingTier}
                              suggested
                            />
                          ))}
                        </SelectGroup>
                      ) : null}
                      {recommendedModelOptions.length > 0 && otherModelOptions.length > 0 ? (
                        <SelectSeparator />
                      ) : null}
                      {otherModelOptions.length > 0 ? (
                        <SelectGroup>
                          {recommendedModelOptions.length > 0 ? (
                            <SelectLabel>All other paid models</SelectLabel>
                          ) : null}
                          {otherModelOptions.map((opt) => (
                            <ModelSelectOption key={opt.id} opt={opt} pricingTier={pricingTier} />
                          ))}
                        </SelectGroup>
                      ) : null}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {modelsScannedAt ? (
                <p className="text-xs text-muted-foreground">
                  Last scan: {new Date(modelsScannedAt).toLocaleString()} ·{" "}
                  {modelSelectOptions.length} model{modelSelectOptions.length === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>
            <SettingRow
              title="Tone of voice"
              description="How generated copy should sound in popups and inline prompts."
              control={
                <Select value={tone} onValueChange={setTone} disabled={!addonEnabled}>
                  <SelectTrigger className="w-full min-w-[16rem] sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer-facing actions</CardTitle>
            <CardDescription>
              Choose what the daily plan may trigger. Each action type is shown at most once per
              customer until its cooldown passes (default 24 hours).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <SettingRow
              title="Tailored upsell popup"
              description="Example: suggest extra tickets for the same competition or a related prize."
              control={
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-muted-foreground" aria-hidden />
                  <Switch
                    checked={upsellPopup}
                    onCheckedChange={setUpsellPopup}
                    disabled={!addonEnabled}
                  />
                </div>
              }
            />
            {upsellPopup ? (
              <SettingRow
                title="Upsell cooldown (hours)"
                description="Minimum time before this customer can see another upsell popup."
                control={
                  <Input
                    className="w-24"
                    value={upsellPopupCooldownHours}
                    onChange={(e) => setUpsellPopupCooldownHours(e.target.value)}
                    inputMode="numeric"
                    disabled={!addonEnabled}
                  />
                }
              />
            ) : null}
            <SettingRow
              title="Competition highlight"
              description="Surface a single competition card when it matches the customer's interests."
              control={
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-muted-foreground" aria-hidden />
                  <Switch
                    checked={competitionHighlight}
                    onCheckedChange={setCompetitionHighlight}
                    disabled={!addonEnabled}
                  />
                </div>
              }
            />
            {competitionHighlight ? (
              <SettingRow
                title="Highlight cooldown (hours)"
                description="Minimum time before this customer can see another competition highlight."
                control={
                  <Input
                    className="w-24"
                    value={competitionHighlightCooldownHours}
                    onChange={(e) => setCompetitionHighlightCooldownHours(e.target.value)}
                    inputMode="numeric"
                    disabled={!addonEnabled}
                  />
                }
              />
            ) : null}
            <SettingRow
              title="Ticket bundle suggestions"
              description="Recommend bundle sizes (e.g. 5 or 10 tickets) at checkout."
              control={
                <div className="flex items-center gap-2">
                  <Ticket className="size-4 text-muted-foreground" aria-hidden />
                  <Switch
                    checked={ticketBundleSuggestion}
                    onCheckedChange={setTicketBundleSuggestion}
                    disabled={!addonEnabled}
                  />
                </div>
              }
            />
            {ticketBundleSuggestion ? (
              <SettingRow
                title="Bundle suggestion cooldown (hours)"
                description="Minimum time before this customer can see another bundle suggestion."
                control={
                  <Input
                    className="w-24"
                    value={ticketBundleSuggestionCooldownHours}
                    onChange={(e) => setTicketBundleSuggestionCooldownHours(e.target.value)}
                    inputMode="numeric"
                    disabled={!addonEnabled}
                  />
                }
              />
            ) : null}
            <SettingRow
              title="Respect responsible play"
              description="Do not show AI upsells when spend limits or self-exclusion apply."
              control={
                <Switch
                  checked={respectSpendLimits}
                  onCheckedChange={setRespectSpendLimits}
                  disabled={!addonEnabled}
                />
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Daily planner</CardTitle>
              <CardDescription>
                Runs on a schedule (cron: POST /api/admin/jobs/run-personalisation-planner). Builds
                user features, calls OpenRouter in batches, and saves plans until the next run.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={runPlannerMutation.isPending}
              onClick={async () => {
                try {
                  const res = await runPlannerMutation.mutateAsync();
                  const s = res.data;
                  const eligible = s?.usersEligible ?? 0;
                  const planned = s?.usersPlanned ?? 0;
                  const batches = s?.llmBatches ?? 0;
                  const firstError = s?.runErrors?.[0];
                  if (firstError) {
                    toast.error(
                      `Planner finished with errors (${eligible} eligible, ${planned} plan rows, ${batches} LLM batch${batches === 1 ? "" : "es"}). ${firstError.slice(0, 160)}`
                    );
                  } else if (eligible > 0 && planned === 0 && batches === 0) {
                    toast.message(
                      `${eligible} users eligible but no LLM batches ran. Restart the admin dev server and try again.`
                    );
                  } else {
                    toast.success(
                      `Planner ${s?.status ?? "done"}: ${eligible} eligible, ${planned} plan rows (${batches} LLM batch${batches === 1 ? "" : "es"})`
                    );
                  }
                } catch {
                  toast.error("Planner run failed.");
                }
              }}
            >
              {runPlannerMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              Run planner now
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {latestRunData?.data ? (
              <p className="mb-3 text-xs text-muted-foreground">
                Last run: {new Date(latestRunData.data.startedAt).toLocaleString()} ·{" "}
                {latestRunData.data.status} · {latestRunData.data.usersEligible ?? 0} eligible ·{" "}
                {latestRunData.data.usersPlanned} plan rows · {latestRunData.data.llmBatches ?? 0}{" "}
                batches · ~{latestRunData.data.estimatedCostUsd.toFixed(4)} USD est.
                {latestRunData.data.runErrors?.length
                  ? ` · Error: ${latestRunData.data.runErrors[0]?.slice(0, 80)}`
                  : null}
              </p>
            ) : null}
            <SettingRow
              title="Enable daily planner"
              description="When off, cron and manual runs exit immediately."
              control={
                <Switch checked={plannerEnabled} onCheckedChange={setPlannerEnabled} />
              }
            />
            <SettingRow
              title="Plan validity (hours)"
              description="How long saved plans stay active until the next successful run."
              control={
                <Input
                  className="w-24"
                  value={plannerIntervalHours}
                  onChange={(e) => setPlannerIntervalHours(e.target.value)}
                  inputMode="numeric"
                />
              }
            />
            <SettingRow
              title="Audience"
              description="Which customers are included in each planner run."
              control={
                <Select
                  value={audienceMode}
                  onValueChange={(v) => setAudienceMode(v as PersonalisationAudienceMode)}
                >
                  <SelectTrigger className="w-full min-w-[14rem] sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid_orders_window">Paid orders in window</SelectItem>
                    <SelectItem value="verified_accounts">All verified accounts</SelectItem>
                    <SelectItem value="orders_or_activity">Orders or recent activity</SelectItem>
                  </SelectContent>
                </Select>
              }
            />
            <SettingRow
              title="Order window (days)"
              control={
                <Input
                  className="w-24"
                  value={audienceOrdersWithinDays}
                  onChange={(e) => setAudienceOrdersWithinDays(e.target.value)}
                  inputMode="numeric"
                />
              }
            />
            <SettingRow
              title="Activity window (days)"
              description="Used when audience includes site activity."
              control={
                <Input
                  className="w-24"
                  value={audienceActivityWithinDays}
                  onChange={(e) => setAudienceActivityWithinDays(e.target.value)}
                  inputMode="numeric"
                />
              }
            />
            <SettingRow
              title="Require marketing consent"
              control={
                <Switch
                  checked={requireMarketingConsent}
                  onCheckedChange={setRequireMarketingConsent}
                />
              }
            />
            <SettingRow
              title="Max users per run"
              control={
                <Input
                  className="w-28"
                  value={maxUsersPerRun}
                  onChange={(e) => setMaxUsersPerRun(e.target.value)}
                  inputMode="numeric"
                />
              }
            />
            <SettingRow
              title="Users per LLM batch"
              control={
                <Input
                  className="w-24"
                  value={usersPerLlmBatch}
                  onChange={(e) => setUsersPerLlmBatch(e.target.value)}
                  inputMode="numeric"
                />
              }
            />
            <SettingRow
              title="Max LLM batches per run"
              control={
                <Input
                  className="w-24"
                  value={maxLlmBatchesPerRun}
                  onChange={(e) => setMaxLlmBatchesPerRun(e.target.value)}
                  inputMode="numeric"
                />
              }
            />
            <SettingRow
              title="Max output tokens per batch"
              control={
                <Input
                  className="w-28"
                  value={maxOutputTokensPerBatch}
                  onChange={(e) => setMaxOutputTokensPerBatch(e.target.value)}
                  inputMode="numeric"
                />
              }
            />
            <SettingRow
              title="Planner model override"
              description="Leave empty to use the connection model above."
              control={
                <Input
                  className="w-full min-w-[12rem] sm:w-64"
                  value={plannerModel}
                  onChange={(e) => setPlannerModel(e.target.value)}
                  placeholder={model || "openai/gpt-4o-mini"}
                />
              }
            />
            <SettingRow
              title="Dry run"
              description="Build features and counts only; no OpenRouter calls."
              control={<Switch checked={dryRunPlanner} onCheckedChange={setDryRunPlanner} />}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wand2 className="size-4 text-primary" aria-hidden />
              <CardTitle className="text-base">Brand instructions</CardTitle>
            </div>
            <CardDescription>
              Optional guidance sent with each request so offers stay on-brand and compliant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="brand-instructions" className="text-sm text-muted-foreground">
              System prompt supplement
            </Label>
            <Textarea
              id="brand-instructions"
              rows={5}
              value={brandInstructions}
              onChange={(e) => setBrandInstructions(e.target.value)}
              disabled={!addonEnabled}
              className="resize-y"
            />
          </CardContent>
        </Card>

        <Card className="border-dashed bg-muted/30">
          <CardHeader>
            <CardTitle className="text-sm font-medium">How it will work</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ol className="list-decimal space-y-2 pl-4">
              <li>The daily planner aggregates purchase and activity signals per customer.</li>
              <li>OpenRouter runs in multi-user batches and writes plans to the database.</li>
              <li>On browse or checkout, the site loads the saved plan (no live LLM call).</li>
              <li>Responsible-play rules and session caps filter what is actually shown.</li>
            </ol>
            <Separator className="my-4" />
            <p className="text-xs">
              API keys and prompts will never be exposed in the browser bundle.
            </p>
          </CardContent>
        </Card>
      </div>
  );

  if (embedded) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-end gap-2">{saveActions}</div>
        {content}
      </div>
    );
  }

  return (
    <PageShell
      title="AI personalisation"
      description="Connect OpenRouter to tailor on-site prompts using each customer's browsing and purchase history."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/addons">Back to addons</Link>
          </Button>
          {saveActions}
        </div>
      }
    >
      {content}
    </PageShell>
  );
}

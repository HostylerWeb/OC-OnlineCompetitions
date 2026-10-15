"use client";

import { MediaReferencePickerDialog } from "@/components/media/MediaReferencePickerDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdminAiPersonalisationSettings,
  useAdminAiPersonalisationSettingsMutations,
  useAdminOpenRouterImageModelsScan,
} from "@oc/api-admin";
import {
  DEFAULT_COMPETITION_IMAGE_PROMPT_TEMPLATE,
  IMAGE_GENERATION_ASPECT_RATIO_LABELS,
  IMAGE_GENERATION_ASPECT_RATIOS,
  partitionOpenRouterImageModels,
  type AiPersonalisationSettings,
  type OpenRouterModelListItem,
} from "@oc/types";
import { Loader2, RefreshCw, Save } from "@oc/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DEFAULT_IMAGE_GENERATION_FORM_STATE,
  imageGenerationFormStateToUpdatePayload,
  imageGenerationSettingsToFormState,
} from "./open-router-image-settings-form";

function imageModelPriceLabel(opt: OpenRouterModelListItem): string {
  if (opt.imagePricingLabel?.trim()) return opt.imagePricingLabel;
  if (opt.isFree) return "Free";
  return "—";
}

function ImageModelSelectOption({ opt }: { opt: OpenRouterModelListItem }) {
  const price = imageModelPriceLabel(opt);

  return (
    <SelectItem value={opt.id}>
      <span className="flex w-full min-w-0 items-center justify-between gap-3">
        <span className="truncate">{opt.name}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{price}</span>
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
  control: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/60 py-4 last:border-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export function OpenRouterImageGenerationView() {
  const { data, isLoading, isError, dataUpdatedAt, isFetching } =
    useAdminAiPersonalisationSettings();
  const { saveSettingsMutation } = useAdminAiPersonalisationSettingsMutations();
  const scanMutation = useAdminOpenRouterImageModelsScan();

  const [enabled, setEnabled] = useState(DEFAULT_IMAGE_GENERATION_FORM_STATE.enabled);
  const [model, setModel] = useState(DEFAULT_IMAGE_GENERATION_FORM_STATE.model);
  const [promptTemplate, setPromptTemplate] = useState(
    DEFAULT_IMAGE_GENERATION_FORM_STATE.promptTemplate
  );
  const [brandColors, setBrandColors] = useState(DEFAULT_IMAGE_GENERATION_FORM_STATE.brandColors);
  const [referenceUrl, setReferenceUrl] = useState(DEFAULT_IMAGE_GENERATION_FORM_STATE.referenceUrl);
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_IMAGE_GENERATION_FORM_STATE.aspectRatio);
  const [descriptionModel, setDescriptionModel] = useState(
    DEFAULT_IMAGE_GENERATION_FORM_STATE.descriptionModel
  );
  const [scannedModels, setScannedModels] = useState<OpenRouterModelListItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const formDirtyRef = useRef(false);
  const syncedAtRef = useRef<number | undefined>(undefined);

  function applyServerSettings(settings: AiPersonalisationSettings) {
    if (!settings) return;
    const next = imageGenerationSettingsToFormState(settings);
    setEnabled(next.enabled);
    setModel(next.model);
    setPromptTemplate(next.promptTemplate);
    setBrandColors(next.brandColors);
    setReferenceUrl(next.referenceUrl);
    setAspectRatio(next.aspectRatio);
    setDescriptionModel(next.descriptionModel);
  }

  function markDirty() {
    formDirtyRef.current = true;
  }

  const apiKeySet = Boolean(
    data?.data?.openRouterApiKeyConfigured || data?.data?.openRouterApiKey?.trim()
  );

  const selectedModelPricing = useMemo(
    () => scannedModels.find((m) => m.id === model),
    [scannedModels, model]
  );

  const { recommended: recommendedModelOptions, other: otherModelOptions } = useMemo(
    () => partitionOpenRouterImageModels(scannedModels),
    [scannedModels]
  );

  useEffect(() => {
    if (!data?.data || isFetching) return;
    if (formDirtyRef.current) return;
    if (syncedAtRef.current === dataUpdatedAt) return;
    syncedAtRef.current = dataUpdatedAt;
    applyServerSettings(data.data);
  }, [data?.data, dataUpdatedAt, isFetching]);

  async function scanModels() {
    if (!apiKeySet) {
      toast.error("Save your OpenRouter API key on the Customer personalisation tab first.");
      return;
    }
    try {
      const res = await scanMutation.mutateAsync();
      const list = res.data?.models ?? [];
      setScannedModels(list);
      if (list.length === 0) {
        toast.message("No image generation models found.");
        return;
      }
      if (!list.some((m) => m.id === model)) setModel(list[0]!.id);
      toast.success(`Found ${list.length} image model${list.length === 1 ? "" : "s"}.`);
    } catch {
      toast.error("Could not load image models from OpenRouter.");
    }
  }

  async function handleSave() {
    try {
      const res = await saveSettingsMutation.mutateAsync(
        imageGenerationFormStateToUpdatePayload({
          enabled,
          model,
          promptTemplate,
          brandColors,
          referenceUrl,
          aspectRatio,
          descriptionModel,
        })
      );
      formDirtyRef.current = false;
      if (res.data) {
        applyServerSettings(res.data);
        syncedAtRef.current = dataUpdatedAt;
      }
      toast.success("Image generation settings saved.");
    } catch {
      toast.error("Could not save settings.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          onClick={handleSave}
          disabled={isLoading || isFetching || saveSettingsMutation.isPending}
        >
          {saveSettingsMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save
        </Button>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load settings</AlertTitle>
          <AlertDescription>Refresh the page or try again.</AlertDescription>
        </Alert>
      ) : null}

      {!apiKeySet ? (
        <Alert>
          <AlertTitle>OpenRouter API key required</AlertTitle>
          <AlertDescription>
            Add your API key under the Customer personalisation tab, then return here to scan image
            models.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Competition image AI</CardTitle>
          <CardDescription>
            Generate competition images (aspect ratio below) and enhance descriptions while creating
            or editing competitions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <SettingRow
            title="Enable image generation on competition form"
            description="Shows Generate with AI on the competition Images tab. Description optimization only needs your OpenRouter API key."
            control={
              <Switch
                checked={enabled}
                onCheckedChange={(v) => {
                  markDirty();
                  setEnabled(v);
                }}
                disabled={!apiKeySet}
              />
            }
          />
          <SettingRow
            title="Image generation model"
            description="Recommended models first (competition/product creatives), then all others cheapest → most expensive."
            control={
              <div className="flex flex-col gap-2 sm:items-end">
                {scannedModels.length > 0 ? (
                  <div
                    className="max-w-sm rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
                    role="note"
                  >
                    Prices come from each model’s image endpoints on OpenRouter. Token-based models
                    show a rough ~1:1 estimate; your bill uses actual usage from the generate call.
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!apiKeySet || scanMutation.isPending}
                  onClick={() => void scanModels()}
                >
                  {scanMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Scan image models
                </Button>
                <Select
                  value={model || undefined}
                  onValueChange={(v) => {
                    markDirty();
                    setModel(v);
                  }}
                  disabled={!apiKeySet || (scannedModels.length === 0 && !model.trim())}
                >
                  <SelectTrigger className="w-full min-w-[14rem] sm:w-72">
                    <SelectValue placeholder="Scan models first" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {model && !scannedModels.some((m) => m.id === model) ? (
                      <SelectItem value={model}>Saved: {model}</SelectItem>
                    ) : null}
                    {recommendedModelOptions.length > 0 ? (
                      <SelectGroup>
                        <SelectLabel>Recommended for competition images</SelectLabel>
                        {recommendedModelOptions.map((m) => (
                          <ImageModelSelectOption key={m.id} opt={m} />
                        ))}
                      </SelectGroup>
                    ) : null}
                    {otherModelOptions.length > 0 ? (
                      <SelectGroup>
                        <SelectLabel>All other models (by price)</SelectLabel>
                        {otherModelOptions.map((m) => (
                          <ImageModelSelectOption key={m.id} opt={m} />
                        ))}
                      </SelectGroup>
                    ) : null}
                  </SelectContent>
                </Select>
                {selectedModelPricing ? (
                  <p className="max-w-sm text-right text-xs text-muted-foreground">
                    {imageModelPriceLabel(selectedModelPricing)}
                  </p>
                ) : null}
              </div>
            }
          />
          <SettingRow
            title="Output aspect ratio"
            description="Sent to OpenRouter as aspect_ratio on every Generate with AI run. Pick what matches your primary image role (square for cards, 16:9 for banners, etc.)."
            control={
              <Select
                value={aspectRatio}
                onValueChange={(v) => {
                  markDirty();
                  setAspectRatio(v as typeof aspectRatio);
                }}
                disabled={!apiKeySet}
              >
                <SelectTrigger className="w-full min-w-[14rem] sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_GENERATION_ASPECT_RATIOS.map((ratio) => (
                    <SelectItem key={ratio} value={ratio}>
                      <span className="flex flex-col items-start gap-0.5">
                        <span className="font-medium tabular-nums">{ratio}</span>
                        <span className="text-xs text-muted-foreground">
                          {IMAGE_GENERATION_ASPECT_RATIO_LABELS[ratio]}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
          <SettingRow
            title="Description enhancement model"
            description="Text model for Optimize description. Leave empty to use the customer personalisation model."
            control={
              <Input
                className="w-full min-w-[14rem] sm:w-72"
                value={descriptionModel}
                onChange={(e) => {
                  markDirty();
                  setDescriptionModel(e.target.value);
                }}
                placeholder={data?.data?.model || "openrouter/free"}
                disabled={!apiKeySet}
              />
            }
          />
          <div className="py-4">
            <Label className="text-sm font-medium">Brand colors</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Replaces [Brand colors] in the prompt (e.g. navy, gold, white).
            </p>
            <Input
              className="mt-2"
              value={brandColors}
              onChange={(e) => {
                markDirty();
                setBrandColors(e.target.value);
              }}
              placeholder="navy, gold, white"
              disabled={!apiKeySet}
            />
          </div>
          <div className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-sm font-medium">Generation prompt template</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!apiKeySet}
                onClick={() => {
                  markDirty();
                  setPromptTemplate(DEFAULT_COMPETITION_IMAGE_PROMPT_TEMPLATE);
                }}
              >
                Use recommended template
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Placeholders: [Name], [Description], [Brand colors], [Aspect ratio], [Reference
              image]. The recommended template asks for on-image headlines (title + short tagline)
              like other raffle sites. Reference is filled with instructions when a gallery reference
              is configured; the image is also sent to the model as an attachment.
            </p>
            <Textarea
              className="mt-2 min-h-[160px] font-mono text-xs"
              value={promptTemplate}
              onChange={(e) => {
                markDirty();
                setPromptTemplate(e.target.value);
              }}
              disabled={!apiKeySet}
            />
          </div>
          <SettingRow
            title="Reference image"
            description="Optional style reference from the media gallery for all competition image generations."
            control={
              <div className="flex flex-col items-end gap-2">
                {referenceUrl ? (
                  <img
                    src={referenceUrl}
                    alt=""
                    className="size-16 rounded-md border object-cover"
                  />
                ) : null}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!apiKeySet}
                    onClick={() => setPickerOpen(true)}
                  >
                    Choose from gallery
                  </Button>
                  {referenceUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        markDirty();
                        setReferenceUrl("");
                      }}
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
              </div>
            }
          />
        </CardContent>
      </Card>

      <MediaReferencePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        value={referenceUrl}
        onSelect={(url) => {
          markDirty();
          setReferenceUrl(url);
        }}
      />
    </div>
  );
}

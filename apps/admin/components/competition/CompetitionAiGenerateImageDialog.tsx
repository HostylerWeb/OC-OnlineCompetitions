"use client";

import { AssetImage } from "@/components/AssetImage";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdminAiPersonalisationSettings,
  useAdminCompetitionAiGenerateImage,
} from "@oc/api-admin";
import { buildCompetitionImagePrompt } from "@oc/api-server/lib/openrouter/build-competition-image-prompt";
import {
  DEFAULT_COMPETITION_IMAGE_PROMPT_TEMPLATE,
  DEFAULT_IMAGE_GENERATION_ASPECT_RATIO,
  IMAGE_GENERATION_ASPECT_RATIO_LABELS,
} from "@oc/types";
import { ExternalLink, Loader2, Sparkles } from "@oc/icons";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getImageGenerationBlockReason } from "./competition-ai-gate";
import type { CompetitionFormState } from "./types";

interface CompetitionAiGenerateImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: CompetitionFormState;
  onImageAddedToPool: (publicUrl: string) => void;
}

export function CompetitionAiGenerateImageDialog({
  open,
  onOpenChange,
  form,
  onImageAddedToPool,
}: CompetitionAiGenerateImageDialogProps) {
  const { data: settingsData, isLoading: settingsLoading } = useAdminAiPersonalisationSettings();
  const generateMutation = useAdminCompetitionAiGenerateImage();
  const settings = settingsData?.data;

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [addedToPool, setAddedToPool] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");
  const promptSeededRef = useRef(false);

  const titleOk = form.title.trim().length > 0;
  const descriptionOk = form.description.trim().length > 0;
  const promptOk = promptDraft.trim().length > 0;
  const blockReason = getImageGenerationBlockReason(settings, settingsLoading);
  const canGenerate =
    !blockReason && titleOk && descriptionOk && promptOk && !generateMutation.isPending;

  const promptPreview = useMemo(() => {
    if (!settings || !titleOk || !descriptionOk) return "";
    const template =
      settings.imageGenerationPromptTemplate?.trim() ||
      DEFAULT_COMPETITION_IMAGE_PROMPT_TEMPLATE;
    return buildCompetitionImagePrompt(template, {
      title: form.title.trim(),
      description: form.description.trim(),
      brandColors: settings.imageGenerationBrandColors ?? "",
      referenceImageUrl: settings.imageGenerationReferenceImageUrl ?? "",
      aspectRatio: settings.imageGenerationAspectRatio,
    });
  }, [settings, form.title, form.description, titleOk, descriptionOk]);

  const modelLabel =
    settings?.imageGenerationModel?.trim() || "Not configured — set under Image generation tab";
  const referenceUrl = settings?.imageGenerationReferenceImageUrl?.trim() ?? "";
  const aspectRatio =
    settings?.imageGenerationAspectRatio ?? DEFAULT_IMAGE_GENERATION_ASPECT_RATIO;
  const aspectRatioHint = IMAGE_GENERATION_ASPECT_RATIO_LABELS[aspectRatio];

  useEffect(() => {
    if (!open) {
      promptSeededRef.current = false;
      setPreviewUrl(null);
      setAddedToPool(false);
      return;
    }
    if (!promptSeededRef.current && promptPreview) {
      setPromptDraft(promptPreview);
      promptSeededRef.current = true;
    }
  }, [open, promptPreview]);

  async function handleGenerate() {
    if (!canGenerate) return;
    setPreviewUrl(null);
    setAddedToPool(false);
    try {
      const slug = form.slug || form.title.toLowerCase().replace(/\s+/g, "-");
      const res = await generateMutation.mutateAsync({
        title: form.title.trim(),
        description: form.description.trim(),
        slug,
        prompt: promptDraft.trim(),
      });
      const url = res.data?.publicUrl;
      if (!url) throw new Error("No image URL returned");
      setPreviewUrl(url);
      onImageAddedToPool(url);
      setAddedToPool(true);
      toast.success("Image added to the competition image pool as Primary.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Image generation failed";
      toast.error("Could not generate image.", { description: msg });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" aria-hidden />
            Generate competition image with AI
          </DialogTitle>
          <DialogDescription>
            Uses your OpenRouter image model and saved prompt template. The result is uploaded to
            storage and added to this competition&apos;s image pool as the primary image.
          </DialogDescription>
        </DialogHeader>

        {blockReason ? (
          <Alert variant="destructive">
            <AlertTitle>Setup required</AlertTitle>
            <AlertDescription>
              {blockReason}{" "}
              <Link
                href="/addons/ai-personalisation"
                className="font-medium underline underline-offset-4"
              >
                Open OpenRouter AI settings
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}

        {!titleOk || !descriptionOk ? (
          <Alert>
            <AlertTitle>Competition details</AlertTitle>
            <AlertDescription>
              Enter a title and full description on the Details tab before generating.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 text-sm">
            <Label className="text-muted-foreground">Model</Label>
            <p className="font-mono text-xs break-all">{modelLabel}</p>
          </div>
          <div className="space-y-1.5 text-sm">
            <Label className="text-muted-foreground">Output</Label>
            <p>
              <span className="font-medium tabular-nums">{aspectRatio}</span>
              {aspectRatioHint ? ` — ${aspectRatioHint}` : null}
              <br />
              Image → media library
            </p>
          </div>
        </div>

        {referenceUrl ? (
          <div className="space-y-2">
            <Label className="text-muted-foreground">Reference image (from addon settings)</Label>
            <div className="relative aspect-square w-24 overflow-hidden rounded-md border bg-muted">
              <AssetImage src={referenceUrl} alt="" fill className="object-cover" />
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="ai-prompt-preview">Prompt sent to OpenRouter</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              disabled={!promptPreview || promptDraft === promptPreview}
              onClick={() => setPromptDraft(promptPreview)}
            >
              Reset from template
            </Button>
          </div>
          <Textarea
            id="ai-prompt-preview"
            value={promptDraft}
            onChange={(e) => setPromptDraft(e.target.value)}
            rows={10}
            className="font-mono text-xs leading-relaxed"
            placeholder="Prompt will appear here when title and description are set…"
          />
          <p className="text-xs text-muted-foreground">
            Edit this text before generating. To change the default wording for all competitions, update
            the template under{" "}
            <Link href="/addons/ai-personalisation" className="text-primary underline-offset-4 hover:underline">
              Addons → OpenRouter AI → Image generation
            </Link>
            .
          </p>
        </div>

        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Label className="text-sm">Preview</Label>
            {addedToPool ? (
              <Badge variant="secondary" className="shrink-0">In image pool · Primary</Badge>
            ) : null}
          </div>
          {generateMutation.isPending ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="size-8 animate-spin" aria-hidden />
              <p className="text-sm">Generating image… this can take up to a minute.</p>
            </div>
          ) : previewUrl ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-md border bg-background shadow-sm">
                <AssetImage
                  src={previewUrl}
                  alt="AI generated competition image"
                  fill
                  className="object-cover"
                  loading="eager"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-2 text-xs text-muted-foreground">
                <p>
                  This image is in your media library and listed below in the image pool. Save the
                  competition to persist roles and URLs.
                </p>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Open full size
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </div>
            </div>
          ) : (
            <p className="min-h-[120px] text-sm text-muted-foreground">
              Click Generate to create a preview here. It will appear in the image pool at the same
              time.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {addedToPool ? "Done" : "Cancel"}
          </Button>
          <Button type="button" disabled={!canGenerate} onClick={() => void handleGenerate()}>
            {generateMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {generateMutation.isPending
              ? "Generating…"
              : addedToPool
                ? "Generate another"
                : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

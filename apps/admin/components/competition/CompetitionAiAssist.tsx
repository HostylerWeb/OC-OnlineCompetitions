"use client";

import type { ReactNode } from "react";
import {
  useAdminAiPersonalisationSettings,
  useAdminCompetitionAiEnhanceDescription,
  useAdminCompetitionAiGenerateImage,
} from "@oc/api-admin";
import { Loader2, Sparkles, Wand2 } from "@oc/icons";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  getDescriptionEnhancementBlockReason,
  getImageGenerationBlockReason,
} from "./competition-ai-gate";
import type { CompetitionFormState } from "./types";

interface CompetitionAiAssistProps {
  form: CompetitionFormState;
  onFormUpdate: (updater: (prev: CompetitionFormState) => CompetitionFormState) => void;
  mode: "description" | "image";
  onSessionUploadedUrl?: (url: string) => void;
}

function GatedAiButton({
  blockReason,
  disabled,
  onClick,
  pending,
  icon,
  label,
}: {
  blockReason: string | null;
  disabled: boolean;
  onClick: () => void;
  pending: boolean;
  icon: ReactNode;
  label: string;
}) {
  const button = (
    <Button
      type="button"
      variant={label === "Generate with AI" ? "secondary" : "outline"}
      size="sm"
      disabled={disabled}
      onClick={onClick}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : icon}
      {label}
    </Button>
  );

  if (!blockReason) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{button}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-pretty">
        {blockReason}
      </TooltipContent>
    </Tooltip>
  );
}

export function CompetitionAiAssist({
  form,
  onFormUpdate,
  mode,
  onSessionUploadedUrl,
}: CompetitionAiAssistProps) {
  const { data: settingsData, isLoading: settingsLoading } = useAdminAiPersonalisationSettings();
  const generateMutation = useAdminCompetitionAiGenerateImage();
  const enhanceMutation = useAdminCompetitionAiEnhanceDescription();

  const settings = settingsData?.data;
  const titleOk = form.title.trim().length > 0;
  const descriptionOk = form.description.trim().length > 0;

  if (mode === "description") {
    const setupBlock = getDescriptionEnhancementBlockReason(settings, settingsLoading);
    const blockReason =
      setupBlock ?? (!titleOk ? "Enter a competition title first." : null);
    const toolsReady = setupBlock === null;

    return (
      <GatedAiButton
        blockReason={blockReason}
        disabled={Boolean(blockReason) || enhanceMutation.isPending}
        pending={enhanceMutation.isPending}
        icon={<Wand2 className="size-4" />}
        label="Optimize description"
        onClick={async () => {
          if (!toolsReady) return;
          try {
            const res = await enhanceMutation.mutateAsync({
              title: form.title.trim(),
              description: form.description,
            });
            const next = res.data?.description;
            if (!next) throw new Error("Empty response");
            onFormUpdate((p) => ({ ...p, description: next }));
            toast.success("Description enhanced.");
          } catch {
            toast.error("Could not enhance description.");
          }
        }}
      />
    );
  }

  const imageSetupBlock = getImageGenerationBlockReason(settings, settingsLoading);
  const imageBlockReason =
    imageSetupBlock ??
    (!titleOk || !descriptionOk
      ? "Enter a title and full description on the Details tab first."
      : null);
  const imageToolsReady = imageSetupBlock === null;

  return (
    <GatedAiButton
      blockReason={imageBlockReason}
      disabled={Boolean(imageBlockReason) || generateMutation.isPending}
      pending={generateMutation.isPending}
      icon={<Sparkles className="size-4" />}
      label="Generate with AI"
      onClick={async () => {
        if (!imageToolsReady || !titleOk || !descriptionOk) return;
        try {
          const slug = form.slug || form.title.toLowerCase().replace(/\s+/g, "-");
          const res = await generateMutation.mutateAsync({
            title: form.title.trim(),
            description: form.description.trim(),
            slug,
          });
          const url = res.data?.publicUrl;
          if (!url) throw new Error("No image URL");
          onSessionUploadedUrl?.(url);
          onFormUpdate((prev) => {
            const withoutPrimary = prev.images.map((img) => ({
              ...img,
              roles: img.roles.filter((r) => r !== "primary"),
            }));
            const existing = withoutPrimary.find((i) => i.url === url);
            if (existing) {
              return {
                ...prev,
                images: withoutPrimary.map((img) =>
                  img.url === url
                    ? { ...img, roles: [...new Set([...img.roles, "primary"])] }
                    : img
                ),
              };
            }
            return {
              ...prev,
              images: [...withoutPrimary, { url, roles: ["primary"] }],
            };
          });
          toast.success("Primary image generated (1:1).");
        } catch {
          toast.error("Image generation failed. Check OpenRouter AI image settings.");
        }
      }}
    />
  );
}

export function CompetitionAiAssistSetupHint() {
  const { data: settingsData, isLoading } = useAdminAiPersonalisationSettings();
  const blockReason = getDescriptionEnhancementBlockReason(settingsData?.data, isLoading);
  if (blockReason) {
    return (
      <span>
        {blockReason}{" "}
        <Link
          href="/addons/ai-personalisation"
          className="text-primary underline-offset-4 hover:underline"
        >
          Open OpenRouter AI settings
        </Link>
      </span>
    );
  }

  return (
    <span>
      Uses the title plus this text. Hover Optimize description if the button is disabled (title
      required).
    </span>
  );
}

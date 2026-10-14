"use client";

import { ImageGallery } from "@/components/media/ImageGallery";
import { ImageShowcasePanel } from "@/components/media/ImageShowcasePanel";
import { FieldDescription, FieldGroup, FieldLegend } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { CompetitionAiAssist } from "./CompetitionAiAssist";
import type { CompetitionFormState } from "./types";

interface CompetitionImagesTabProps {
  form: CompetitionFormState;
  onFormUpdate: (updater: (prev: CompetitionFormState) => CompetitionFormState) => void;
  onUploadsInFlightChange?: (inFlight: boolean) => void;
  onSessionUploadedUrl?: (url: string) => void;
}

function CompetitionImagesTab({
  form,
  onFormUpdate,
  onUploadsInFlightChange,
  onSessionUploadedUrl,
}: CompetitionImagesTabProps) {
  const slug = form.slug || form.title.toLowerCase().replace(/\s+/g, "-");

  function handleAssignRole(url: string, role: "primary" | "hero" | "og" | "ref") {
    onFormUpdate((prev) => {
      const targetImage = prev.images.find((i) => i.url === url);
      if (targetImage?.roles.includes(role)) return prev;

      return {
        ...prev,
        images: prev.images.map((img) => {
          if (img.url === url) {
            const roles = new Set(img.roles);
            roles.add(role);
            return { ...img, roles: [...roles] };
          }
          if (img.roles.includes(role)) {
            return { ...img, roles: img.roles.filter((r) => r !== role) };
          }
          return img;
        }),
      };
    });
  }

  function handleClearRole(role: "primary" | "hero" | "og" | "ref") {
    onFormUpdate((prev) => ({
      ...prev,
      images: prev.images.map((img) =>
        img.roles.includes(role) ? { ...img, roles: img.roles.filter((r) => r !== role) } : img
      ),
    }));
  }

  return (
    <FieldGroup className="gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <FieldLegend variant="label">Image pool</FieldLegend>
            <FieldDescription>Upload and manage all images for this competition.</FieldDescription>
          </div>
          <CompetitionAiAssist
            form={form}
            onFormUpdate={onFormUpdate}
            mode="image"
            onSessionUploadedUrl={onSessionUploadedUrl}
          />
        </div>
        <FieldDescription>
          Generate with AI requires title and full description on the Details tab. Creates a 1:1
          primary image using your saved OpenRouter prompt and reference.
        </FieldDescription>

        <ImageGallery
          images={form.images}
          onChange={(imgsOrFn) => {
            onFormUpdate((prev) => ({
              ...prev,
              images: typeof imgsOrFn === "function" ? imgsOrFn(prev.images) : imgsOrFn,
            }));
          }}
          onAssignRole={handleAssignRole}
          onClearRole={handleClearRole}
          slug={slug}
          onUploadsInFlightChange={onUploadsInFlightChange}
          onSessionUploadedUrl={onSessionUploadedUrl}
        />
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <FieldLegend variant="label">Image Role Assignments</FieldLegend>
          <FieldDescription>
            Assign which images appear as the card thumbnail, banner, social sharing preview, or
            referral link preview.
          </FieldDescription>
        </div>

        <ImageShowcasePanel
          images={form.images}
          onAssignRole={handleAssignRole}
          onClearRole={handleClearRole}
        />
      </section>
    </FieldGroup>
  );
}

export { CompetitionImagesTab };

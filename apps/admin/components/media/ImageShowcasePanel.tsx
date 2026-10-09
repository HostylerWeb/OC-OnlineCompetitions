"use client";

import { Eye, Flag, Image as ImageIcon, RotateCcw, Search, Share2, Star } from "@oc/icons";
import { useState } from "react";
import { AssetImage } from "@/components/AssetImage";
import type { CompetitionImage } from "@/components/competition/types";
import { ZoomableImageGallery } from "@/components/image-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ImageShowcasePanelProps {
  images: CompetitionImage[];
  onAssignRole: (url: string, role: "primary" | "hero" | "og" | "ref") => void;
  onClearRole: (role: "primary" | "hero" | "og" | "ref") => void;
  className?: string;
}

export function ImageShowcasePanel({
  images,
  onAssignRole,
  onClearRole,
  className,
}: ImageShowcasePanelProps) {
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);

  if (images.length === 0) {
    return (
      <div className={cn("rounded-lg border border-dashed p-6 text-center", className)}>
        <p className="text-sm font-medium text-muted-foreground">
          Upload images to the gallery below, then assign Primary and Hero roles here.
        </p>
      </div>
    );
  }

  const primaryImage = images.find((i) => i.roles.includes("primary"));
  const heroImage = images.find((i) => i.roles.includes("hero"));
  const ogImage = images.find((i) => i.roles.includes("og"));
  const refImage = images.find((i) => i.roles.includes("ref"));

  const primaryImageUrl = primaryImage?.url;
  const heroImageUrl = heroImage?.url;
  const ogImageUrl = ogImage?.url;
  const refImageUrl = refImage?.url;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="grid gap-4 @md:grid-cols-4">
        <ShowcaseCard
          label="Primary"
          icon={<Star className="size-4 text-primary" aria-hidden="true" />}
          imageUrl={primaryImageUrl}
          poolOptions={images.filter((i) => i.url !== primaryImageUrl)}
          onAssign={(url) => onAssignRole(url, "primary")}
          onClear={() => onClearRole("primary")}
          onView={() => {
            if (primaryImageUrl) setViewingUrl(primaryImageUrl);
          }}
          description="Card thumbnail in listings."
        />
        <ShowcaseCard
          label="Hero"
          icon={<Flag className="size-4 text-muted-foreground" aria-hidden="true" />}
          imageUrl={heroImageUrl}
          poolOptions={images.filter((i) => i.url !== heroImageUrl)}
          onAssign={(url) => onAssignRole(url, "hero")}
          onClear={() => onClearRole("hero")}
          onView={() => {
            if (heroImageUrl) setViewingUrl(heroImageUrl);
          }}
          description="Banner on the competition page."
        />
        <ShowcaseCard
          label="OG Image"
          icon={<Search className="size-4 text-muted-foreground" aria-hidden="true" />}
          imageUrl={ogImageUrl}
          poolOptions={images.filter((i) => i.url !== ogImageUrl)}
          onAssign={(url) => onAssignRole(url, "og")}
          onClear={() => onClearRole("og")}
          onView={() => {
            if (ogImageUrl) setViewingUrl(ogImageUrl);
          }}
          description="Social sharing preview image."
        />
        <ShowcaseCard
          label="Referral OG"
          icon={<Share2 className="size-4 text-muted-foreground" aria-hidden="true" />}
          imageUrl={refImageUrl}
          poolOptions={images.filter((i) => i.url !== refImageUrl)}
          onAssign={(url) => onAssignRole(url, "ref")}
          onClear={() => onClearRole("ref")}
          onView={() => {
            if (refImageUrl) setViewingUrl(refImageUrl);
          }}
          description="OG image when shared with referral link."
        />
      </div>

      <ZoomableImageGallery
        images={viewingUrl ? [viewingUrl] : []}
        open={!!viewingUrl}
        onClose={() => setViewingUrl(null)}
        currentIndex={0}
        onIndexChange={() => {}}
        variant="fullscreen"
      />
    </div>
  );
}

interface ShowcaseCardProps {
  label: string;
  icon: React.ReactNode;
  imageUrl?: string;
  poolOptions: CompetitionImage[];
  onAssign: (url: string) => void;
  onClear: () => void;
  onView: () => void;
  description: string;
}

function ShowcaseCard({
  label,
  icon,
  imageUrl,
  poolOptions,
  onAssign,
  onClear,
  onView,
  description,
}: ShowcaseCardProps) {
  const [open, setOpen] = useState(false);
  const hasImages = poolOptions.length > 0;

  return (
    <Card className="gap-0 overflow-hidden py-0 transition-all duration-200">
      <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {label}
        </CardTitle>
        {imageUrl ? (
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            onClick={onClear}
            aria-label={`Clear ${label}`}
            title={`Return ${label} to pool`}
          >
            <RotateCcw className="size-4" />
          </Button>
        ) : null}
      </CardHeader>

      <CardContent
        className={cn(
          "relative flex h-44 items-center justify-center overflow-hidden bg-muted/20 p-0",
          !imageUrl && "border border-dashed border-muted-foreground/20"
        )}
      >
        {imageUrl ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onView}
            className="group/view relative h-full w-full overflow-hidden rounded-none p-0"
            aria-label={`View ${label}`}
          >
            <AssetImage
              src={imageUrl}
              alt={label}
              fill
              className="object-cover transition-transform duration-300 group-hover/view:scale-105"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-background/0 transition-colors group-hover/view:bg-background/20">
              <div className="rounded-full bg-background/80 p-2 opacity-0 transition-opacity group-hover/view:opacity-100">
                <Search className="size-4 text-foreground" aria-hidden="true" />
              </div>
            </div>
          </Button>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 px-4 text-center">
            <div className="rounded-full bg-muted p-3">
              <ImageIcon className="size-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-xs text-muted-foreground">
              {hasImages
                ? "Select from pool below"
                : "No image assigned — upload images to the pool first"}
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center gap-2 border-t bg-muted/30 px-3 py-2">
        <p className="flex-1 text-xs text-muted-foreground">{description}</p>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant={imageUrl ? "outline" : "default"}
              disabled={!hasImages}
            >
              {imageUrl ? "Change" : "Assign"}
            </Button>
          </PopoverTrigger>
          <PopoverContent autoFocus={false} align="end" className="w-72 border p-2">
            <p className="px-1 pb-1.5 text-xs font-medium text-muted-foreground">Select an image</p>
            <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
              {imageUrl && (
                <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground bg-muted/50">
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                    <AssetImage src={imageUrl} alt="" fill className="object-cover" />
                  </div>
                  <span className="truncate text-xs">{imageUrl.split("/").pop()}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">(current)</span>
                </div>
              )}
              {poolOptions.map((img) => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => {
                    onAssign(img.url);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors text-left"
                >
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                    <AssetImage src={img.url} alt="" fill className="object-cover" />
                  </div>
                  <span className="truncate text-xs">{img.url.split("/").pop()}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          size="sm"
          variant={imageUrl ? "outline" : "ghost"}
          onClick={onView}
          disabled={!imageUrl}
        >
          <Eye data-icon="inline-start" />
          View
        </Button>
      </CardFooter>
    </Card>
  );
}

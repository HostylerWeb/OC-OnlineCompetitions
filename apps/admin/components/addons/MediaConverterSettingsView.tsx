"use client";

import {
  DEFAULT_IMAGE_CONVERTER,
  DEFAULT_VIDEO_CONVERTER,
  IMAGE_SCOPE_LABELS,
  type ImageConverterUiState,
  type MediaConverterScope,
  settingsToUiState,
  uiStateToSavePayload,
  VIDEO_SCOPE_LABELS,
  type VideoConverterUiState,
} from "@/components/addons/media-converter-types";
import { MediaConverterBulkPanel } from "@/components/addons/MediaConverterBulkPanel";
import { QualitySliderField } from "@/components/addons/QualitySliderField";
import { ScopeToggles } from "@/components/addons/ScopeToggles";
import { PageShell } from "@/components/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminMediaConverterSettings, useAdminMediaConverterSettingsMutations } from "@oc/api-admin";
import { Film, ImageIcon, Info, RotateCcw, Save } from "@oc/icons";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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

export function MediaConverterSettingsView() {
  const { data, isLoading, isError } = useAdminMediaConverterSettings();
  const { saveSettingsMutation } = useAdminMediaConverterSettingsMutations();

  const [addonEnabled, setAddonEnabled] = useState(false);
  const [image, setImage] = useState<ImageConverterUiState>(DEFAULT_IMAGE_CONVERTER);
  const [video, setVideo] = useState<VideoConverterUiState>(DEFAULT_VIDEO_CONVERTER);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!data?.data || hydrated) return;
    const ui = settingsToUiState(data.data);
    setAddonEnabled(ui.addonEnabled);
    setImage(ui.image);
    setVideo(ui.video);
    setHydrated(true);
  }, [data?.data, hydrated]);

  const summary = useMemo(() => {
    const imageOn = addonEnabled && image.enabled;
    const videoOn = addonEnabled && video.enabled;
    return { imageOn, videoOn };
  }, [addonEnabled, image.enabled, video.enabled]);

  function resetDefaults() {
    if (data?.data) {
      const ui = settingsToUiState(data.data);
      setAddonEnabled(ui.addonEnabled);
      setImage(ui.image);
      setVideo(ui.video);
      toast.message("Reverted to last saved settings.");
      return;
    }
    setAddonEnabled(false);
    setImage(DEFAULT_IMAGE_CONVERTER);
    setVideo(DEFAULT_VIDEO_CONVERTER);
    toast.message("Reset to defaults.");
  }

  async function handleSave() {
    try {
      await saveSettingsMutation.mutateAsync(
        uiStateToSavePayload({ addonEnabled, image, video })
      );
      toast.success("Media converter settings saved.");
    } catch {
      toast.error("Could not save settings. Try again.");
    }
  }

  function patchImage(patch: Partial<ImageConverterUiState>) {
    setImage((prev) => ({ ...prev, ...patch }));
  }

  function patchVideo(patch: Partial<VideoConverterUiState>) {
    setVideo((prev) => ({ ...prev, ...patch }));
  }

  function patchImageScope(scope: MediaConverterScope, checked: boolean) {
    setImage((prev) => ({ ...prev, scopes: { ...prev.scopes, [scope]: checked } }));
  }

  function patchVideoScope(scope: MediaConverterScope, checked: boolean) {
    setVideo((prev) => ({ ...prev, scopes: { ...prev.scopes, [scope]: checked } }));
  }

  return (
    <PageShell
      title="Media converter"
      description="Configure automatic WebP and WebM conversion for eligible uploads."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/addons">Back to addons</Link>
          </Button>
          <Button type="button" variant="outline" onClick={resetDefaults} disabled={isLoading}>
            <RotateCcw className="size-4" />
            Reset
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isLoading || saveSettingsMutation.isPending}
          >
            <Save className="size-4" />
            Save settings
          </Button>
        </div>
      }
    >
      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load settings</AlertTitle>
          <AlertDescription>Refresh the page or try again in a moment.</AlertDescription>
        </Alert>
      ) : null}

      <Alert>
        <Info className="size-4" />
        <AlertTitle>Live on upload</AlertTitle>
        <AlertDescription>
          When enabled, the API transcodes matching uploads before they are stored. Frame strips for
          landing scroll animations stay JPEG; source landing videos can be converted to WebM when
          that scope is on.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Addon status</CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              When the master switch is off, uploads keep their original format regardless of image
              or video sub-settings.
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="addon-master" className="text-sm text-muted-foreground">
                Enable addon
              </Label>
              <Switch
                id="addon-master"
                checked={addonEnabled}
                disabled={isLoading}
                onCheckedChange={setAddonEnabled}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              <Badge variant={summary.imageOn ? "default" : "outline"}>
                Image {summary.imageOn ? "on" : "off"}
              </Badge>
              <Badge variant={summary.videoOn ? "default" : "outline"}>
                Video {summary.videoOn ? "on" : "off"}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <MediaConverterBulkPanel addonReady={summary.imageOn || summary.videoOn} />

      <Tabs defaultValue="image" className="w-full">
        <TabsList>
          <TabsTrigger value="image" className="gap-2">
            <ImageIcon className="size-4" />
            Image
          </TabsTrigger>
          <TabsTrigger value="video" className="gap-2">
            <Film className="size-4" />
            Video
          </TabsTrigger>
          <TabsTrigger value="how-it-works">How it works</TabsTrigger>
        </TabsList>

        <TabsContent value="image" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Image conversion</CardTitle>
              <CardDescription>
                Applies on upload after validation. Output replaces the original object in storage
                (WebP extension).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-0">
              <SettingRow
                title="Convert uploads to WebP"
                description="Eligible image uploads are transcoded before they reach the CDN."
                control={
                  <Switch
                    checked={image.enabled}
                    disabled={!addonEnabled || isLoading}
                    onCheckedChange={(checked) => patchImage({ enabled: checked })}
                  />
                }
              />
              <SettingRow
                title="Target format"
                description="Fixed output for this addon."
                control={
                  <Badge variant="secondary" className="font-mono text-xs">
                    WebP
                  </Badge>
                }
              />
              <div className="py-4">
                <QualitySliderField
                  id="image-quality"
                  label="Quality"
                  description="Higher values look sharper but increase file size. Typical range: 75–90."
                  value={image.quality}
                  disabled={!addonEnabled || !image.enabled || isLoading}
                  onChange={(quality) => patchImage({ quality })}
                />
              </div>
              <Separator />
              <div className="grid gap-4 py-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="image-max-w">Max width (px)</Label>
                  <Input
                    id="image-max-w"
                    type="number"
                    min={320}
                    max={8192}
                    disabled={!addonEnabled || !image.enabled || isLoading}
                    value={image.maxWidth}
                    onChange={(e) =>
                      patchImage({ maxWidth: Number.parseInt(e.target.value, 10) || image.maxWidth })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="image-max-h">Max height (px)</Label>
                  <Input
                    id="image-max-h"
                    type="number"
                    min={320}
                    max={8192}
                    disabled={!addonEnabled || !image.enabled || isLoading}
                    value={image.maxHeight}
                    onChange={(e) =>
                      patchImage({
                        maxHeight: Number.parseInt(e.target.value, 10) || image.maxHeight,
                      })
                    }
                  />
                </div>
              </div>
              <Separator />
              <div className="pt-4">
                <p className="mb-3 text-sm font-medium">Apply to</p>
                <ScopeToggles
                  labels={IMAGE_SCOPE_LABELS}
                  scopes={image.scopes}
                  disabled={!addonEnabled || !image.enabled || isLoading}
                  onToggle={patchImageScope}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="video" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Video conversion</CardTitle>
              <CardDescription>
                Transcode competition and library videos to WebM (VP9) for smaller files.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-0">
              <SettingRow
                title="Convert uploads to WebM"
                description="Uses server-side ffmpeg when enabled."
                control={
                  <Switch
                    checked={video.enabled}
                    disabled={!addonEnabled || isLoading}
                    onCheckedChange={(checked) => patchVideo({ enabled: checked })}
                  />
                }
              />
              <SettingRow
                title="Target format"
                control={
                  <Badge variant="secondary" className="font-mono text-xs">
                    WebM (VP9)
                  </Badge>
                }
              />
              <div className="py-4">
                <QualitySliderField
                  id="video-quality"
                  label="Quality (CRF-style)"
                  description="Higher slider values map to better quality and larger files."
                  value={video.quality}
                  disabled={!addonEnabled || !video.enabled || isLoading}
                  onChange={(quality) => patchVideo({ quality })}
                />
              </div>
              <SettingRow
                title="Preserve audio track"
                description="Disable for silent loops or b-roll-only assets."
                control={
                  <Switch
                    checked={video.preserveAudio}
                    disabled={!addonEnabled || !video.enabled || isLoading}
                    onCheckedChange={(preserveAudio) => patchVideo({ preserveAudio })}
                  />
                }
              />
              <div className="py-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="video-max-w">Max width (px)</Label>
                  <Input
                    id="video-max-w"
                    type="number"
                    min={480}
                    max={3840}
                    disabled={!addonEnabled || !video.enabled || isLoading}
                    value={video.maxWidth}
                    onChange={(e) =>
                      patchVideo({ maxWidth: Number.parseInt(e.target.value, 10) || video.maxWidth })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Height scales to preserve aspect ratio.
                  </p>
                </div>
              </div>
              <Separator />
              <div className="pt-4">
                <p className="mb-3 text-sm font-medium">Apply to</p>
                <ScopeToggles
                  labels={VIDEO_SCOPE_LABELS}
                  scopes={video.scopes}
                  disabled={!addonEnabled || !video.enabled || isLoading}
                  onToggle={patchVideoScope}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="how-it-works" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How it works</CardTitle>
              <CardDescription>Upload pipeline with the addon enabled.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  Staff or customer uploads a file through an enabled scope (media library, landing
                  video, avatar, etc.).
                </li>
                <li>API validates size and MIME type as today.</li>
                <li>
                  If the addon and scope are on, the server transcodes to WebP or WebM at the quality
                  you set, then stores the optimized file.
                </li>
                <li>
                  Use <strong>Convert existing library</strong> above to backfill WebP/WebM for files
                  already in the bucket, verify them, then optionally delete originals.
                </li>
              </ol>
              <Separator />
              <p>
                SVG and GIF images are never converted. If ffmpeg is unavailable, video uploads fall
                back to the original format.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

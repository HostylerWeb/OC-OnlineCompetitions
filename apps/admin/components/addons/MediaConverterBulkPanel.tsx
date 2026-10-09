"use client";

import type { MediaConverterBulkConvertResultItem, MediaConverterBulkPreview } from "@oc/types";
import {
  useAdminMediaConverterBulkMutations,
} from "@oc/api-admin";
import { AlertTriangle, CheckCircle2, Loader2, Trash2, Wand2 } from "@oc/icons";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type Phase = "idle" | "scanning" | "converting" | "verified" | "done";

function batchSizeForKind(kind: "image" | "video"): number {
  return kind === "video" ? 1 : 5;
}

export function MediaConverterBulkPanel({ addonReady }: { addonReady: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<MediaConverterBulkPreview | null>(null);
  const [results, setResults] = useState<MediaConverterBulkConvertResultItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { scanPreviewMutation, convertBatchMutation, verifyMutation, deleteOriginalsMutation } =
    useAdminMediaConverterBulkMutations();

  const originalsPending = useMemo(
    () =>
      results
        .filter((r) => r.status === "converted" && r.originalKeyForDeletion)
        .map((r) => r.originalKeyForDeletion as string),
    [results]
  );

  const summary = useMemo(() => {
    const converted = results.filter((r) => r.status === "converted").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const verified = results.filter((r) => r.verified).length;
    return { converted, failed, verified };
  }, [results]);

  async function handleScan() {
    setPhase("scanning");
    setResults([]);
    setProgress(0);
    try {
      const res = await scanPreviewMutation.mutateAsync();
      const data = res.data;
      setPreview(data);
      setPhase("idle");
      if (data.items.length === 0) {
        toast.message("Nothing to convert", {
          description: "All eligible files are already WebP/WebM or out of scope.",
        });
      }
    } catch {
      toast.error("Could not scan storage.");
      setPhase("idle");
    }
  }

  async function handleConvertAll() {
    if (!preview || preview.items.length === 0) return;
    setPhase("converting");
    setResults([]);
    const allResults: MediaConverterBulkConvertResultItem[] = [];
    const items = preview.items;
    let index = 0;

    while (index < items.length) {
      const item = items[index]!;
      const batch = [item.key];
      let j = index + 1;
      while (
        j < items.length &&
        batch.length < batchSizeForKind(item.kind) &&
        items[j]!.kind === "image" &&
        item.kind === "image"
      ) {
        batch.push(items[j]!.key);
        j += 1;
      }

      try {
        const res = await convertBatchMutation.mutateAsync(batch);
        const batchResults = res.data.results ?? [];
        allResults.push(...batchResults);
        setResults([...allResults]);
      } catch {
        toast.error("Conversion batch failed", { description: batch.join(", ") });
      }

      index = j;
      setProgress(Math.round((index / items.length) * 100));
    }

    setProgress(100);

    const newKeys = allResults
      .filter((r) => r.status === "converted" || r.status === "already_optimal")
      .map((r) => r.newKey);

    if (newKeys.length > 0) {
      try {
        const verifyRes = await verifyMutation.mutateAsync(newKeys);
        if (!verifyRes.data.ok) {
          toast.error("Some converted files failed verification.");
        }
      } catch {
        toast.error("Verification step failed.");
      }
    }

    setPhase("verified");
    const convertedCount = allResults.filter((r) => r.status === "converted").length;
    const failedCount = allResults.filter((r) => r.status === "failed").length;
    if (failedCount === 0 && allResults.length > 0) {
      toast.success("Conversion complete", {
        description: `${convertedCount} file(s) optimized.`,
      });
    } else if (failedCount > 0) {
      toast.error(`${failedCount} file(s) failed to convert.`);
    }
  }

  async function handleDeleteOriginals() {
    if (originalsPending.length === 0) return;
    try {
      const res = await deleteOriginalsMutation.mutateAsync(originalsPending);
      const deleted = res.data.deleted ?? 0;
      toast.success(`Deleted ${deleted} original file(s).`);
      setPhase("done");
      setDeleteOpen(false);
    } catch {
      toast.error("Could not delete originals.");
    }
  }

  const totalEligible = (preview?.eligibleImages ?? 0) + (preview?.eligibleVideos ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Convert existing library</CardTitle>
        <CardDescription>
          Scan storage, convert eligible files to WebP/WebM using the settings above, verify uploads,
          then optionally remove originals (PNG, JPEG, MP4, etc.).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!addonReady ? (
          <p className="text-sm text-muted-foreground">
            Enable the addon and turn on image or video conversion before running a bulk migrate.
          </p>
        ) : null}

        {preview ? (
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <p>
              <span className="text-muted-foreground">Images to convert:</span>{" "}
              <strong>{preview.eligibleImages}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Videos to convert:</span>{" "}
              <strong>{preview.eligibleVideos}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Already WebP/WebM:</span>{" "}
              {preview.alreadyTargetFormat}
            </p>
            <p>
              <span className="text-muted-foreground">Skipped:</span> {preview.skipped}
            </p>
          </div>
        ) : null}

        {phase === "converting" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Converting…</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        ) : null}

        {phase === "verified" && results.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <div className="flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>
                {summary.converted} converted, {summary.verified} verified in storage
                {summary.failed > 0 ? `, ${summary.failed} failed` : ""}.
                MongoDB URLs were updated where references matched.
              </span>
            </div>
            {originalsPending.length > 0 ? (
              <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  {originalsPending.length} original file(s) can be removed from the bucket (new
                  WebP/WebM copies are in place).
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!addonReady || phase === "converting" || scanPreviewMutation.isPending}
            onClick={() => void handleScan()}
          >
            {scanPreviewMutation.isPending || phase === "scanning" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wand2 className="size-4" />
            )}
            Scan storage
          </Button>
          <Button
            type="button"
            disabled={
              !addonReady || !preview || totalEligible === 0 || phase === "converting"
            }
            onClick={() => void handleConvertAll()}
          >
            {phase === "converting" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wand2 className="size-4" />
            )}
            Convert all ({totalEligible})
          </Button>
          {phase === "verified" && originalsPending.length > 0 ? (
            <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" />
              Delete originals ({originalsPending.length})
            </Button>
          ) : null}
        </div>
      </CardContent>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {originalsPending.length} original files?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the pre-conversion objects from storage. Site data already
              points at the new WebP/WebM files. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteOriginalsMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteOriginalsMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteOriginals();
              }}
            >
              {deleteOriginalsMutation.isPending ? "Deleting…" : "Delete originals"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

"use client";

import { api } from "@oc/api-admin";
import { Loader2 } from "@oc/icons";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FlatAsset = { key: string; url: string; size: number };

interface MediaReferencePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onSelect: (url: string) => void;
}

export function MediaReferencePickerDialog({
  open,
  onOpenChange,
  value,
  onSelect,
}: MediaReferencePickerDialogProps) {
  const [assets, setAssets] = useState<FlatAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ flat: "1", type: "image", limit: "50" });
      if (search.trim()) params.set("search", search.trim());
      const res = await api.get<{ assets: FlatAsset[] }>(`/api/admin/media/assets?${params}`);
      setAssets(res.data?.assets?.filter((a) => a.size > 0) ?? []);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Choose reference image</DialogTitle>
          <DialogDescription>
            Pick an image from the media gallery to guide AI generation.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            placeholder="Search gallery…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load();
            }}
          />
          <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
            Search
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : assets.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No images found.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {assets.map((asset) => (
                <button
                  key={asset.key}
                  type="button"
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-md border-2 bg-muted",
                    value === asset.url ? "border-primary" : "border-transparent"
                  )}
                  onClick={() => {
                    onSelect(asset.url);
                    onOpenChange(false);
                  }}
                >
                  <img src={asset.url} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

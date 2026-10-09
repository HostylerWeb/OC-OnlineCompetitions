"use client";

import { Upload } from "@oc/icons";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function MediaUploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      let successCount = 0;
      let failCount = 0;
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        try {
          await fetch("/api/admin/media/upload", { method: "POST", body: formData });
          successCount++;
        } catch {
          failCount++;
        }
      }
      if (successCount > 0) {
        toast.success(`Uploaded ${successCount} file${successCount === 1 ? "" : "s"}`);
        window.location.reload();
      }
      if (failCount > 0) {
        toast.error(`Failed to upload ${failCount} file${failCount === 1 ? "" : "s"}`);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        data-umami-event="media:upload"
      >
        <Upload />
        {uploading ? "Uploading..." : "Upload"}
      </Button>
    </>
  );
}

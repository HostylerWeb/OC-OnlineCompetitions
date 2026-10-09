"use client";
import { api } from "@oc/api-admin";
import { useRef, useState } from "react";
import { S3FilePicker } from "@/components/media/S3FilePicker";
import { cn } from "@/lib/utils";
import { ImagePreview } from "./image-preview";
import { Spinner } from "./ui/spinner";

interface ImageUploadProps {
  value?: string;
  onUpload: (url: string, blurDataUrl?: string) => void;
  onError?: (message: string) => void;
  maxSizeMB?: number;
  slug?: string;
  className?: string;
}

type UploadState = "idle" | "validating" | "uploading" | "uploaded" | "error";

export function ImageUpload({
  value,
  onUpload,
  onError,
  maxSizeMB = 10,
  slug,
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>(value ? "uploaded" : "idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function uploadFile(file: File) {
    setState("validating");
    setErrorMsg("");

    if (!file.type.startsWith("image/")) {
      const msg = "Please select an image file.";
      setErrorMsg(msg);
      onError?.(msg);
      setState("error");
      return;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      const msg = `File must be smaller than ${maxSizeMB}MB.`;
      setErrorMsg(msg);
      onError?.(msg);
      setState("error");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const random = Math.random().toString(36).slice(2);
    const key = slug
      ? `prizes/${slug}/${Date.now()}-${random}.${ext}`
      : `uploads/${Date.now()}-${random}.${ext}`;

    setState("uploading");
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("key", key);
      const uploadRes = await fetch("/api/admin/media/upload", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.status}`);
      }
      const uploadData = await uploadRes.json();
      const { publicUrl, blurDataUrl } = uploadData.data ?? uploadData;

      setProgress(30);

      setProgress(80);

      setProgress(100);
      setState("uploaded");
      onUpload(publicUrl, blurDataUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setErrorMsg(msg);
      onError?.(msg);
      setState("error");
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleClick() {
    inputRef.current?.click();
  }

  function handleRemove() {
    if (inputRef.current) inputRef.current.value = "";
    if (value) {
      api.delete("/api/admin/media/assets", { params: { url: value } }).catch(() => {});
    }
    setState("idle");
    setProgress(0);
    setErrorMsg("");
    onUpload("", undefined);
  }

  function handleBrowseSelect(urls: string[]) {
    const url = urls[0];
    if (url) onUpload(url, undefined);
  }

  const isUploaded = state === "uploaded" && value;
  const isUploading = state === "uploading" || state === "validating";

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      {isUploaded && value ? (
        <div className="relative group">
          <ImagePreview src={value} alt="Uploaded image" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
            <button
              type="button"
              onClick={handleClick}
              className="rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-black hover:bg-gold-light transition-colors"
            >
              Change
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={handleDragLeave}
          className={cn(
            "relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all duration-200",
            isDragging
              ? "border-gold/60 bg-gold/10 cursor-pointer"
              : isUploading
                ? "border-gold/50 bg-gold/5 cursor-wait"
                : state === "error"
                  ? "border-red-500/50 bg-red-500/5"
                  : "border-gold/30 bg-gradient-to-br from-gold/5 to-transparent hover:border-gold/60 hover:from-gold/10"
          )}
        >
          {isUploading ? (
            <>
              <Spinner className="h-6 w-6 text-gold" />
              <span className="text-sm font-medium text-gold/70">
                {state === "validating"
                  ? "Validating\u2026"
                  : `Uploading\u2026 ${Math.round(progress)}%`}
              </span>
              {state === "uploading" && (
                <div className="h-1 w-48 overflow-hidden rounded-full bg-gold/20">
                  <div
                    className="h-full bg-gradient-to-r from-gold to-gold-dark transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="rounded-full bg-gold/10 p-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="h-6 w-6 text-gold"
                >
                  <title>Upload image</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                  />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gold">Click to upload or drag & drop</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PNG, JPG, WEBP up to {maxSizeMB}MB
                </p>
              </div>
            </>
          )}

          {state === "error" && <p className="text-xs font-medium text-red-500">{errorMsg}</p>}
        </div>
      )}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="text-xs font-medium text-gold hover:text-gold-light transition-colors self-start"
      >
        Browse Storage →
      </button>

      <S3FilePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleBrowseSelect}
        multiple={false}
        selectedUrls={value ? [value] : []}
      />
    </div>
  );
}

"use client";

import { api, type FrameExtractionStatus, useFrameExtractionSSE } from "@oc/api-admin";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoadingSpinner } from "@/components/AppLoader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VideoUploadProps {
  competitionId: string;
  value?: string;
  onUpload: (url: string) => void;
  onError?: (message: string) => void;
  className?: string;
}

type UploadState =
  | "idle"
  | "presigning"
  | "uploading"
  | "confirming"
  | "extracting"
  | "uploaded"
  | "error";

const ACCEPTED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_SIZE_MB = 100;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export function VideoUpload({
  competitionId,
  value,
  onUpload,
  onError,
  className,
}: VideoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>(value ? "uploaded" : "idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const confirmedVideoUrlRef = useRef<string | null>(null);

  const { data: extractionData } = useFrameExtractionSSE(
    state === "extracting" ? competitionId : null
  );

  const uploadFile = useCallback(
    async (file: File) => {
      setState("presigning");
      setErrorMsg("");
      setProgress(5);

      if (!ACCEPTED_TYPES.includes(file.type)) {
        const msg = "Please select a video file (mp4, webm, or quicktime).";
        setErrorMsg(msg);
        onError?.(msg);
        setState("error");
        return;
      }

      if (file.size > MAX_SIZE_BYTES) {
        const msg = `File must be smaller than ${MAX_SIZE_MB}MB.`;
        setErrorMsg(msg);
        onError?.(msg);
        setState("error");
        return;
      }

      let presignedKey: string;
      let publicUrl: string;
      let uploadUrl: string;

      try {
        setProgress(10);
        const { data: presignData } = await api.get<{
          uploadUrl: string;
          publicUrl: string;
          key: string;
        }>(`/api/admin/competitions/${competitionId}/landing-video/presign`, {
          params: { "content-type": file.type },
        });
        presignedKey = presignData.key;
        publicUrl = presignData.publicUrl;
        uploadUrl = presignData.uploadUrl;
        setProgress(20);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to start upload";
        setErrorMsg(msg);
        onError?.(msg);
        setState("error");
        return;
      }

      setState("uploading");
      setProgress(25);

      try {
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        const response = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
          signal,
        });

        if (!response.ok) {
          throw new Error(`S3 rejected the upload: ${response.status} ${response.statusText}`);
        }

        setProgress(80);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          setErrorMsg("Upload was cancelled.");
          onError?.("Upload was cancelled.");
        } else {
          const msg = err instanceof Error ? err.message : "Upload to S3 failed";
          setErrorMsg(msg);
          onError?.(msg);
        }
        setState("error");
        abortControllerRef.current = null;
        return;
      }

      setState("confirming");
      setProgress(90);

      try {
        await api.post<{ jobId: string; status: string; message: string }>(
          `/api/admin/competitions/${competitionId}/landing-video/confirm`,
          { key: presignedKey }
        );

        confirmedVideoUrlRef.current = publicUrl;

        setState("extracting");
        setProgress(0);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to confirm upload";
        setErrorMsg(msg);
        onError?.(msg);
        setState("error");
      }
    },
    [competitionId, onUpload, onError]
  );

  const handleExtractionStatus = useCallback(
    (data: FrameExtractionStatus) => {
      if (data.status === "completed") {
        setState("uploaded");
        const url = confirmedVideoUrlRef.current ?? "";
        confirmedVideoUrlRef.current = null;
        onUpload(url);
      } else if (data.status === "failed" || data.status === "abandoned") {
        setState("error");
        setErrorMsg(data.errorMessage ?? "Frame extraction failed");
        onError?.(data.errorMessage ?? "Frame extraction failed");
        confirmedVideoUrlRef.current = null;
      } else if (data.status === "pending" || data.status === "running") {
        if (data.framesTotal != null && data.framesTotal > 0) {
          const pct = Math.round((data.framesExtracted / data.framesTotal) * 100);
          setProgress(pct);
        } else {
          setProgress(0);
        }
      }
    },
    [onUpload, onError]
  );

  useEffect(() => {
    if (state === "extracting" && extractionData) {
      handleExtractionStatus(extractionData);
    }
  }, [state, extractionData, handleExtractionStatus]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleRemove() {
    abortControllerRef.current?.abort();
    if (inputRef.current) inputRef.current.value = "";
    setState("idle");
    setProgress(0);
    setErrorMsg("");
    confirmedVideoUrlRef.current = null;
    onUpload("");
    void api.delete(`/api/admin/competitions/${competitionId}/landing-video`);
  }

  const isUploaded = state === "uploaded" && value;
  const isUploading =
    state === "presigning" ||
    state === "uploading" ||
    state === "confirming" ||
    state === "extracting";

  const progressLabel =
    state === "presigning"
      ? "Preparing upload…"
      : state === "uploading"
        ? `Uploading directly to S3… ${Math.round(progress)}%`
        : state === "confirming"
          ? "Finalising…"
          : state === "extracting"
            ? extractionData
              ? `Extracting frames… ${extractionData.framesExtracted}`
              : "Extracting frames…"
            : null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={handleChange}
      />

      {isUploaded && value ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <span className="text-sm font-medium text-foreground truncate flex-1">
              {value.split("/").pop()?.split("-").slice(-1)[0] ?? "Video uploaded"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600"
              onClick={handleRemove}
            >
              Remove
            </Button>
          </div>
          <video
            src={value}
            controls
            className="max-h-48 w-full rounded-lg object-cover"
            aria-label="Uploaded video preview"
          >
            <track kind="captions" />
          </video>
        </div>
      ) : (
        <div
          onClick={() => !isUploading && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all duration-200",
            isUploading
              ? "cursor-wait border-gold/50 bg-gold/5"
              : isDragging
                ? "border-gold/60 bg-gold/10 cursor-pointer"
                : state === "error"
                  ? "border-red-500/50 bg-red-500/5"
                  : "border-gold/30 bg-gradient-to-br from-gold/5 to-transparent hover:border-gold/60 hover:from-gold/10"
          )}
        >
          {isUploading ? (
            <>
              <LoadingSpinner className="h-6 w-6 text-gold" />
              <span className="text-sm font-medium text-gold/70">{progressLabel}</span>
              {(state === "uploading" || state === "confirming" || state === "extracting") && (
                <div className="h-1 w-48 overflow-hidden rounded-full bg-gold/20">
                  <div
                    className="h-full bg-gradient-to-r from-gold to-gold-dark transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {state === "uploading"
                  ? "Uploading directly to storage — this is not through the API server"
                  : state === "extracting"
                    ? "Frames are being extracted in the background"
                    : null}
              </p>
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
                  aria-label="icon"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
                  />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gold">Click to upload or drag & drop</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  MP4, WEBM, QUICKTIME up to {MAX_SIZE_MB}MB
                </p>
              </div>
            </>
          )}

          {state === "error" && <p className="text-xs font-medium text-red-500">{errorMsg}</p>}
        </div>
      )}
    </div>
  );
}

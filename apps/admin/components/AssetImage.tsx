import { cn } from "@/lib/utils";

export interface AssetImageProps extends Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src" | "alt"
> {
  src: string;
  alt: string;
  /** Parent must be `position: relative` with defined size. */
  fill?: boolean;
}

/** Renders storage/CDN URLs directly (MinIO, assets.onlinecompetitions.co.uk) — no Next.js image optimizer. */
export function AssetImage({
  src,
  alt,
  fill,
  className,
  loading = "lazy",
  decoding = "async",
  ...props
}: AssetImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding={decoding}
      className={cn(fill && "absolute inset-0 h-full w-full", className)}
      {...props}
    />
  );
}

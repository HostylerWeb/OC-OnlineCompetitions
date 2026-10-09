import type { S3Asset } from "@oc/api-storage/s3";

export type { S3Asset };

export interface Usage {
  type: "competition" | "page" | "prize" | "other";
  id: string;
  label: string;
  url?: string;
}

export interface Meta {
  width?: number;
  height?: number;
  duration?: number;
  contentType?: string;
  etag?: string;
}

export type AssetType = "image" | "video" | "other";
export type AssetTypeFilter = "all" | AssetType;
export type AssetSort = "newest" | "name" | "size";
export type AssetView = "grid" | "list";

export interface S3AssetView extends S3Asset {
  meta?: Meta;
  usages?: Usage[];
}

export interface UsageResponse {
  usages: Record<string, Usage[]>;
}

export interface MetadataResponse {
  metadata: Record<string, Meta>;
}

export interface DeleteBatchResult {
  key: string;
  ok: boolean;
  error?: string;
}

export interface DeleteBatchResponse {
  results: DeleteBatchResult[];
}

export const FRAME_PREFIX = "frames/";

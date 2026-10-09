import type { AdminReferralSummary, EntryCompetitionsSummary } from "@oc/types";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export type PaginationSummary = EntryCompetitionsSummary | AdminReferralSummary;

export interface PaginationMeta {
  page?: number;
  limit?: number;
  total?: number;
  pages?: number;
  hasMore?: boolean;
  nextCursor?: string;
  summary?: PaginationSummary;
  sortableFields?: string[];
}

interface SuccessEnvelope<T> {
  data: T | T[];
  error?: never;
  meta?: PaginationMeta;
}

interface ErrorEnvelope {
  data?: never;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: never;
}

export function success<T>(c: Context, data: T, meta?: PaginationMeta) {
  return c.json({ data, meta } as SuccessEnvelope<T>);
}

export function created<T>(c: Context, data: T) {
  return c.json({ data } as SuccessEnvelope<T>, 201);
}

export function error(c: Context, code: string, message: string, status = 400, details?: unknown) {
  return c.json(
    { error: { code, message, details } } as ErrorEnvelope,
    status as ContentfulStatusCode
  );
}

export function paginated<T>(
  c: Context,
  items: T[],
  total: number,
  page: number,
  limit: number,
  extra?: { sortableFields?: string[]; summary?: PaginationSummary }
) {
  return c.json({
    data: items,
    meta: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
      hasMore: total > page * limit,
      ...(extra?.sortableFields ? { sortableFields: extra.sortableFields } : {}),
      ...(extra?.summary ? { summary: extra.summary } : {}),
    },
  } as SuccessEnvelope<T>);
}

export function cursorPaginated<T>(
  c: Context,
  items: T[],
  options: { limit: number; hasMore: boolean; nextCursor?: string; total?: number }
) {
  return c.json({
    data: items,
    meta: {
      limit: options.limit,
      hasMore: options.hasMore,
      nextCursor: options.nextCursor,
      total: options.total,
    },
  } as SuccessEnvelope<T>);
}

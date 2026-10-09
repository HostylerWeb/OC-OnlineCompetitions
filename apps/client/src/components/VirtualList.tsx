"use client";

import { cn } from "@oc/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ListProps } from "react-window";
import { List } from "react-window";

type ExcludeForbiddenKeys_2<Type> = Omit<Type, "ariaAttributes" | "index" | "style">;

export interface VirtualListProps<RowProps extends object> {
  rowComponent: NonNullable<ListProps<RowProps>["rowComponent"]>;
  rowHeight: number;
  rowProps: ExcludeForbiddenKeys_2<RowProps>;
  className?: string;
  height?: number;
  isInfinite?: boolean;
  fetchNextPage?: () => void;
  hasMore?: boolean;
  isFetchingNextPage?: boolean;
  overscanStopIndexThreshold?: number;
  ticketWidth?: number;
  ticketGap?: number;
  totalCount?: number;
  rowCount?: number;
}

const FALLBACK_WIDTH = 320;

export function VirtualList<RowProps extends object>({
  rowComponent,
  rowHeight,
  rowProps,
  className,
  height: heightProp,
  isInfinite = false,
  fetchNextPage,
  hasMore = false,
  isFetchingNextPage = false,
  overscanStopIndexThreshold = 3,
  ticketWidth = 120,
  ticketGap = 8,
  totalCount,
  rowCount: rowCountProp,
}: VirtualListProps<RowProps> & { totalCount?: number; rowCount?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect.width;
      setContainerWidth(width);
    });
    observer.observe(el);
    const initialWidth = el.getBoundingClientRect().width;
    setContainerWidth(initialWidth);

    return () => observer.disconnect();
  }, [ticketWidth, ticketGap]);

  const width = containerWidth || FALLBACK_WIDTH;
  const horizontalPadding = ticketGap * 2;
  const usableWidth = Math.max(0, width - horizontalPadding);
  const effectiveTicketsPerRow =
    rowCountProp != null && totalCount == null
      ? Math.max(1, Math.floor((usableWidth + ticketGap) / (ticketWidth + ticketGap)) || 1)
      : Math.max(
          1,
          Math.min(
            Math.floor((usableWidth + ticketGap) / (ticketWidth + ticketGap)) || 1,
            totalCount != null && totalCount > 0 ? totalCount : Number.POSITIVE_INFINITY
          )
        );
  const computedRowCount =
    rowCountProp ?? (totalCount != null ? Math.ceil(totalCount / effectiveTicketsPerRow) : 1);
  const rowCount = Math.max(1, computedRowCount);
  const listHeight = heightProp ?? rowCount * rowHeight;

  const handleRowsRendered = useCallback<NonNullable<ListProps<RowProps>["onRowsRendered"]>>(
    ({ stopIndex }) => {
      if (!isInfinite || !fetchNextPage || !hasMore || isFetchingNextPage) return;
      if (stopIndex >= rowCount - overscanStopIndexThreshold) {
        fetchNextPage();
      }
    },
    [isInfinite, fetchNextPage, hasMore, isFetchingNextPage, rowCount, overscanStopIndexThreshold]
  );

  if (rowCount <= 0 || width <= 0) return null;

  return (
    <div
      ref={containerRef}
      className={cn("flex w-full flex-col", isFetchingNextPage && "skeleton-default")}
    >
      <div className="relative w-full" style={{ height: listHeight, minHeight: listHeight }}>
        <List
          {...({
            style: { height: listHeight, width },
            width,
            height: listHeight,
            rowCount,
            rowHeight,
            rowComponent,
            rowProps: {
              ...rowProps,
              ticketWidth,
              ticketGap,
              ticketsPerRow: effectiveTicketsPerRow,
            },
            className,
            onRowsRendered: isInfinite ? handleRowsRendered : undefined,
          } as ListProps<RowProps>)}
        />
      </div>
    </div>
  );
}

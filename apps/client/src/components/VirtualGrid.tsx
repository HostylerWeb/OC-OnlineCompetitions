"use client";

import { cn } from "@oc/utils";
import type { ReactNode } from "react";
import { VirtualList, type VirtualListProps } from "./VirtualList";

export interface VirtualGridProps<RowProps extends object & { columnCount: number }>
  extends Omit<VirtualListProps<RowProps>, "rowCount"> {
  itemCount: number;
  columnCount: number;
}

export function VirtualGrid<RowProps extends object & { columnCount: number }>({
  itemCount,
  columnCount,
  rowHeight,
  rowComponent,
  rowProps,
  ...rest
}: VirtualGridProps<RowProps>) {
  const rowCount = Math.ceil(itemCount / columnCount);
  return (
    <VirtualList
      rowCount={rowCount}
      rowHeight={rowHeight}
      rowComponent={rowComponent}
      rowProps={{ ...rowProps, columnCount } as VirtualListProps<RowProps>["rowProps"]}
      {...rest}
    />
  );
}

export interface VirtualTableColumn<T> {
  id: string;
  header: ReactNode;
  cell: (item: T, index: number) => ReactNode;
  className?: string;
}

export interface VirtualTableProps<T> {
  items: T[];
  columns: VirtualTableColumn<T>[];
  rowHeight?: number;
  maxHeight?: string;
  isInfinite?: boolean;
  fetchNextPage?: () => void;
  hasMore?: boolean;
  isFetchingNextPage?: boolean;
  getRowKey?: (item: T, index: number) => string;
}

function VirtualTableRow<T>({
  index,
  style,
  items,
  columns,
  getRowKey,
}: {
  index: number;
  style: React.CSSProperties;
  items: T[];
  columns: VirtualTableColumn<T>[];
  getRowKey?: (item: T, index: number) => string;
}) {
  const item = items[index];
  if (!item) return null;
  const key = getRowKey?.(item, index) ?? String(index);

  return (
    <div
      key={key}
      style={style}
      className="flex items-center border-b border-border/60 px-4 transition-colors hover:bg-muted/30"
    >
      {columns.map((col) => (
        <div key={col.id} className={cn(col.className ?? "flex-1 min-w-0 py-2 text-sm", "min-w-0")}>
          {col.cell(item, index)}
        </div>
      ))}
    </div>
  );
}

export function VirtualTable<T>({
  items,
  columns,
  rowHeight = 48,
  maxHeight = "480px",
  isInfinite,
  fetchNextPage,
  hasMore,
  isFetchingNextPage,
  getRowKey,
}: VirtualTableProps<T>) {
  const height = Math.min(items.length * rowHeight, parseInt(maxHeight, 10) || 480);

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
      <div className="flex items-center border-b border-border/60 bg-muted/20 px-4 py-2">
        {columns.map((col) => (
          <div
            key={col.id}
            className={cn(
              col.className ??
                "flex-1 min-w-0 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
              "min-w-0"
            )}
          >
            {col.header}
          </div>
        ))}
      </div>
      <VirtualList
        rowCount={items.length}
        rowHeight={rowHeight}
        height={height}
        isInfinite={isInfinite}
        fetchNextPage={fetchNextPage}
        hasMore={hasMore}
        isFetchingNextPage={isFetchingNextPage}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rowComponent={VirtualTableRow as any}
        rowProps={{ items, columns, getRowKey }}
      />
    </div>
  );
}

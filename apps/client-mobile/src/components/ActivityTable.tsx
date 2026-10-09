"use client";
import { ArrowRight } from "@oc/icons";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

export interface ActivityColumn<T> {
  id: string;
  header?: string;
  cell: (item: T) => ReactNode;
  className?: string;
}

export interface ActivityTableProps<T> {
  title: string;
  viewAllHref?: string;
  columns: ActivityColumn<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  rowKey: (item: T) => string;
  onRowClick?: (item: T) => void;
  variant?: "default" | "winners";
}

function ActivityTable<T>({
  title,
  viewAllHref,
  columns,
  data,
  isLoading = false,
  emptyMessage = "No items",
  rowKey,
  onRowClick,
}: ActivityTableProps<T>) {
  return (
    <Card className="gap-0 overflow-hidden border-border/70 py-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/60 bg-muted/20 pt-4 pb-4">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {viewAllHref ? (
          <a
            href={viewAllHref}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-8 px-3 text-xs text-primary hover:bg-accent hover:text-accent-foreground"
          >
            View all
            <ArrowRight data-icon="inline-end" />
          </a>
        ) : null}
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col gap-3 px-6 py-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" shimmer />
            ))}
          </div>
        ) : data.length === 0 ? (
          <EmptyState title={emptyMessage} variant="embedded" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead
                    key={col.id}
                    className={cn("text-[0.625rem] uppercase tracking-wider", col.className)}
                  >
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => {
                const key = rowKey(item);
                return (
                  <TableRow
                    key={key}
                    className={cn(onRowClick && "cursor-pointer")}
                    onClick={() => onRowClick?.(item)}
                  >
                    {columns.map((col) => (
                      <TableCell key={col.id} className={col.className}>
                        {col.cell(item)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export { ActivityTable };

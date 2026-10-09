"use client";

import { ArrowLeft, ArrowRight, ChevronsLeft, ChevronsRight } from "@oc/icons";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface AdminTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  pagination: PaginationState;
  onPaginationChange: Dispatch<SetStateAction<PaginationState>>;
  pageCount: number;
  isLoading?: boolean;
  emptyMessage?: string;
  transition?: boolean;
  compact?: boolean;
  maxHeight?: string;
  children?: ReactNode;
}

function AdminTable<TData>({
  columns,
  data,
  pagination,
  onPaginationChange,
  pageCount,
  isLoading = false,
  emptyMessage = "No results found",
  transition = true,
  compact = false,
  maxHeight,
  children,
}: AdminTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
    state: { pagination },
    onPaginationChange,
  });

  const { pageIndex, pageSize } = pagination;

  return (
    <div className={cn("dashboard-table-panel", transition && "transition-colors duration-200")}>
      <div
        className={cn(
          "overflow-x-auto",
          maxHeight && "overflow-y-auto",
          compact && "max-h-[400px]"
        )}
        style={{ maxHeight: maxHeight ?? undefined }}
      >
        <Table className="admin-table">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-b border-border hover:bg-transparent"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-10 whitespace-nowrap px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: Math.min(pageSize, 5) }).map((_row, i) => (
                <TableRow key={`skeleton-${i}`} className="border-b border-border/60">
                  {columns.map((_col, j) => (
                    <TableCell key={`cell-${i}-${j}`} className="px-4 py-3">
                      <Skeleton
                        className={cn("h-5 w-full max-w-[100px]", j === 0 && "max-w-[200px]")}
                        shimmer
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="border-t border-dashed border-border/60 py-0"
                >
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>{emptyMessage}</EmptyTitle>
                      <EmptyDescription>No records to display.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-b border-border/60 transition-colors hover:bg-muted/30"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!isLoading && data.length > 0 ? (
        <div className="flex items-center justify-between border-t border-border/70 px-4 py-3">
          <span className="text-xs text-muted-foreground">
            Page {pageIndex + 1} of {pageCount}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onPaginationChange({ pageIndex: 0, pageSize })}
              disabled={pageIndex === 0}
              aria-label="Go to first page"
            >
              <ChevronsLeft className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                onPaginationChange({
                  pageIndex: pageIndex - 1,
                  pageSize,
                })
              }
              disabled={pageIndex === 0}
              aria-label="Go to previous page"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                onPaginationChange({
                  pageIndex: pageIndex + 1,
                  pageSize,
                })
              }
              disabled={pageIndex >= pageCount - 1}
              aria-label="Go to next page"
            >
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                onPaginationChange({
                  pageIndex: pageCount - 1,
                  pageSize,
                })
              }
              disabled={pageIndex >= pageCount - 1}
              aria-label="Go to last page"
            >
              <ChevronsRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}

      {children}
    </div>
  );
}

export type { AdminTableProps };
export { AdminTable };

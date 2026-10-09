"use client";

import { MoreHorizontal } from "@oc/icons";
import { formatDate } from "@oc/utils";
import { type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, DataTableColumnHeader } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NotificationRow {
  _id: string;
  title: string;
  type: string;
  status: string;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  marketing: "Marketing",
  system: "System",
  draw_result: "Draw Result",
  promotional: "Promotional",
  reminder: "Reminder",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STATUS_VARIANTS: Record<string, string> = {
  draft: "draft",
  scheduled: "warning",
  sending: "info",
  sent: "success",
  failed: "destructive",
  cancelled: "draft",
} as const;

interface NotificationHistoryTableProps {
  data: NotificationRow[];
  pageCount: number;
  pagination: PaginationState;
  onPaginationChange: (
    updater: PaginationState | ((prev: PaginationState) => PaginationState)
  ) => void;
  isLoading: boolean;
  onResend: (id: string) => void;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
  resendPending?: boolean;
  deletePending?: boolean;
}

export function NotificationHistoryTable({
  data,
  pageCount,
  pagination,
  onPaginationChange,
  isLoading,
  onResend,
  onDelete,
  onView,
  resendPending,
  deletePending,
}: NotificationHistoryTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<NotificationRow | null>(null);
  const [resendTarget, setResendTarget] = useState<NotificationRow | null>(null);

  const columns: ColumnDef<NotificationRow>[] = useMemo(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => onView(row.original._id)}
            className="truncate text-sm font-medium transition-colors hover:text-primary"
          >
            {row.original.title}
          </button>
        ),
      },
      {
        accessorKey: "type",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {TYPE_LABELS[row.original.type] ?? row.original.type}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const status = row.original.status;
          const variant = STATUS_VARIANTS[status] ?? "draft";
          return (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                variant === "success"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : variant === "destructive"
                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    : variant === "warning"
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                      : variant === "info"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {STATUS_LABELS[status] ?? status}
            </span>
          );
        },
      },
      {
        accessorKey: "sentCount",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Sent" />,
        cell: ({ row }) => (
          <span className="font-mono text-sm text-green-600 dark:text-green-400">
            {row.original.sentCount}
          </span>
        ),
      },
      {
        accessorKey: "failedCount",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Failed" />,
        cell: ({ row }) => (
          <span className="font-mono text-sm text-red-600 dark:text-red-400">
            {row.original.failedCount}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => e.stopPropagation()}
                aria-label="Actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => onView(row.original._id)}
                data-umami-event="notification:view-detail"
              >
                View details
              </DropdownMenuItem>
              {row.original.status !== "draft" && row.original.status !== "scheduled" && (
                <DropdownMenuItem
                  onClick={() => setResendTarget(row.original)}
                  data-umami-event="notification:resend"
                >
                  Resend
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {(row.original.status === "draft" || row.original.status === "scheduled") && (
                <DropdownMenuItem
                  onClick={() => setDeleteTarget(row.original)}
                  className="text-destructive focus:text-destructive"
                  data-umami-event="notification:delete"
                >
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [onView]
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        isLoading={isLoading}
        emptyTitle="No notifications yet"
        emptyDescription="Create your first push notification campaign."
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete notification"
        description={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        isLoading={deletePending}
        onConfirm={() => {
          if (deleteTarget) {
            onDelete(deleteTarget._id);
            setDeleteTarget(null);
            toast.success("Notification deleted");
          }
        }}
      />

      <ConfirmDialog
        open={resendTarget !== null}
        onOpenChange={(open) => !open && setResendTarget(null)}
        title="Resend notification"
        description={`Resend "${resendTarget?.title}" to all active subscribers?`}
        confirmLabel="Resend"
        isLoading={resendPending}
        onConfirm={() => {
          if (resendTarget) {
            onResend(resendTarget._id);
            setResendTarget(null);
          }
        }}
      />
    </>
  );
}

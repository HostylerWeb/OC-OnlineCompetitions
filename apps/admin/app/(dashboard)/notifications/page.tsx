"use client";

import {
  useAdminNotificationMutations,
  useAdminNotificationStats,
  useAdminNotifications,
} from "@oc/api-admin";
import { Bell, Send, Smartphone, Users } from "@oc/icons";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { NotificationHistoryTable } from "@/components/notifications/NotificationHistoryTable";
import { NotificationStatsCard } from "@/components/notifications/NotificationStatsCard";
import {
  SendNotificationForm,
  type SendNotificationFormValues,
} from "@/components/notifications/SendNotificationForm";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function NotificationsAdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const page = Number(searchParams.get("page") ?? "1");
  const typeFilter = searchParams.get("type") ?? "";
  const statusFilter = searchParams.get("status") ?? "";

  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: listResponse, isLoading } = useAdminNotifications({
    page,
    type: typeFilter,
    status: statusFilter,
  });
  const { data: statsResponse } = useAdminNotificationStats();

  const listData = listResponse?.data as
    | {
        items: Array<{
          _id: string;
          title: string;
          type: string;
          status: string;
          sentCount: number;
          failedCount: number;
          createdAt: string;
        }>;
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }
    | undefined;

  const stats = statsResponse?.data as
    | {
        totalActiveSubscriptions: number;
        totalSentToday: number;
        totalSentThisMonth: number;
        averageDeliveryRate: number;
      }
    | undefined;

  const { sendMutation, deleteMutation, resendMutation } = useAdminNotificationMutations();

  const items = listData?.items ?? [];
  const totalPages = listData?.totalPages ?? 1;
  const pagination = { pageIndex: page - 1, pageSize: 20 };

  const setPagination = useCallback(
    (
      updater:
        | { pageIndex: number; pageSize: number }
        | ((prev: { pageIndex: number; pageSize: number }) => {
            pageIndex: number;
            pageSize: number;
          })
    ) => {
      const next = typeof updater === "function" ? updater(pagination) : updater;
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(next.pageIndex + 1));
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, pagination]
  );

  const handleSend = useCallback(
    (values: SendNotificationFormValues) => {
      const targetUserIds = values.targetUserIds
        ? values.targetUserIds
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
      const targetSubscriptionIds = values.targetSubscriptionIds
        ? values.targetSubscriptionIds
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
      sendMutation.mutate(
        {
          title: values.title,
          body: values.body,
          type: values.type,
          url: values.url || "/",
          icon: values.icon || "/icons/icon-192x192.svg",
          targetFilter: {
            allUsers: values.allUsers,
            ...(targetUserIds?.length ? { userIds: targetUserIds } : {}),
            ...(targetSubscriptionIds?.length ? { subscriptionIds: targetSubscriptionIds } : {}),
          },
          ...(values.scheduleAt ? { scheduleAt: new Date(values.scheduleAt).toISOString() } : {}),
        },
        {
          onSuccess: () => {
            toast.success(values.scheduleAt ? "Notification scheduled" : "Notification sent");
            setDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
          },
          onError: (err: unknown) => {
            toast.error(err instanceof Error ? err.message : "Failed to send notification");
          },
        }
      );
    },
    [sendMutation, queryClient]
  );

  const handleResend = useCallback(
    (id: string) => {
      resendMutation.mutate(id, {
        onSuccess: () => toast.success("Notification resent"),
        onError: (err: unknown) =>
          toast.error(err instanceof Error ? err.message : "Failed to resend"),
      });
    },
    [resendMutation]
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate(id, {
        onSuccess: () => toast.success("Notification deleted"),
        onError: (err: unknown) =>
          toast.error(err instanceof Error ? err.message : "Failed to delete"),
      });
    },
    [deleteMutation]
  );

  const handleView = useCallback(
    (id: string) => {
      router.push(`/notifications/${id}`);
    },
    [router]
  );

  return (
    <PageShell
      title="Notifications"
      description="Compose and send push notifications to users."
      actions={
        <div className="flex items-center gap-2">
          <Link href="/notifications/subscriptions">
            <Button variant="outline" data-umami-event="notification:view-subscriptions">
              <Smartphone className="size-4" />
              Push Subscriptions
            </Button>
          </Link>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-umami-event="notification:create-open">
                <Send className="size-4" />
                Create Notification
              </Button>
            </DialogTrigger>
            <DialogContent size="sm" className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Send Notification</DialogTitle>
                <DialogDescription>Compose a push notification to send to users.</DialogDescription>
              </DialogHeader>
              <SendNotificationForm onSubmit={handleSend} isSubmitting={sendMutation.isPending} />
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <NotificationStatsCard
          label="Active Subscriptions"
          value={stats?.totalActiveSubscriptions ?? "—"}
          icon={<Users className="size-5" />}
        />
        <NotificationStatsCard
          label="Sent Today"
          value={stats?.totalSentToday ?? "—"}
          icon={<Send className="size-5" />}
        />
        <NotificationStatsCard
          label="Sent This Month"
          value={stats?.totalSentThisMonth ?? "—"}
          icon={<Bell className="size-5" />}
        />
      </div>

      <NotificationHistoryTable
        data={items}
        pageCount={totalPages}
        pagination={pagination}
        onPaginationChange={setPagination}
        isLoading={isLoading}
        onResend={handleResend}
        onDelete={handleDelete}
        onView={handleView}
        resendPending={resendMutation.isPending}
        deletePending={deleteMutation.isPending}
      />
    </PageShell>
  );
}

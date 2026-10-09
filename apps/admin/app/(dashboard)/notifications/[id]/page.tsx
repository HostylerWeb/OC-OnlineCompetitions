"use client";

import { useAdminNotification, useAdminNotificationMutations } from "@oc/api-admin";
import { ArrowLeft, Send } from "@oc/icons";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { NotificationDetail } from "@/components/notifications/NotificationDetail";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";

export default function NotificationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: response, isLoading } = useAdminNotification(id);
  const { resendMutation } = useAdminNotificationMutations();

  const notification = response?.data as
    | {
        _id: string;
        title: string;
        body: string;
        type: string;
        status: string;
        url?: string;
        icon?: string;
        sentCount: number;
        failedCount: number;
        createdAt: string;
        sentAt?: string;
        scheduledAt?: string;
        createdBy?: { email?: string; firstName?: string; lastName?: string };
      }
    | undefined;

  const handleResend = useCallback(() => {
    resendMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Notification resent");
        router.push("/notifications");
      },
      onError: (err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Failed to resend"),
    });
  }, [id, resendMutation, router]);

  if (isLoading) {
    return (
      <PageShell title="Loading..." description="Fetching notification details">
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Loading...
        </div>
      </PageShell>
    );
  }

  if (!notification) {
    return (
      <PageShell title="Not found" description="This notification does not exist.">
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Notification not found
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={notification.title}
      description={`${notification.type} · ${notification.status}`}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/notifications">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
          {notification.status !== "draft" && notification.status !== "scheduled" && (
            <Button onClick={handleResend} disabled={resendMutation.isPending}>
              <Send className="size-4" />
              {resendMutation.isPending ? "Resending..." : "Resend"}
            </Button>
          )}
        </div>
      }
    >
      <NotificationDetail
        notification={notification as Parameters<typeof NotificationDetail>[0]["notification"]}
      />
    </PageShell>
  );
}

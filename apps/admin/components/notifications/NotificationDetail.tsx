"use client";

import { formatDateTime } from "@oc/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NotificationDetailProps {
  notification: {
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
  };
}

export function NotificationDetail({ notification }: NotificationDetailProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{notification.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">{notification.body}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-muted-foreground">Type</span>
              <p className="font-medium capitalize">{notification.type.replace("_", " ")}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Status</span>
              <p className="font-medium capitalize">{notification.status}</p>
            </div>
            {notification.url && (
              <div>
                <span className="text-xs text-muted-foreground">URL</span>
                <p className="font-mono text-xs">{notification.url}</p>
              </div>
            )}
            {notification.scheduledAt && (
              <div>
                <span className="text-xs text-muted-foreground">Scheduled</span>
                <p className="font-medium">{formatDateTime(notification.scheduledAt)}</p>
              </div>
            )}
            {notification.sentAt && (
              <div>
                <span className="text-xs text-muted-foreground">Sent at</span>
                <p className="font-medium">{formatDateTime(notification.sentAt)}</p>
              </div>
            )}
            <div>
              <span className="text-xs text-muted-foreground">Created</span>
              <p className="font-medium">{formatDateTime(notification.createdAt)}</p>
            </div>
            {notification.createdBy && (
              <div>
                <span className="text-xs text-muted-foreground">Created by</span>
                <p className="font-medium">
                  {notification.createdBy.firstName ?? ""} {notification.createdBy.lastName ?? ""}
                  {notification.createdBy.email ? ` (${notification.createdBy.email})` : ""}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Delivery Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                {notification.sentCount}
              </p>
              <p className="text-xs text-green-600 dark:text-green-500">Sent</p>
            </div>
            <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                {notification.failedCount}
              </p>
              <p className="text-xs text-red-600 dark:text-red-500">Failed</p>
            </div>
          </div>
          {notification.sentCount + notification.failedCount > 0 && (
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{
                    width: `${(notification.sentCount / (notification.sentCount + notification.failedCount)) * 100}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {Math.round(
                  (notification.sentCount / (notification.sentCount + notification.failedCount)) *
                    100
                )}
                % delivery rate
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

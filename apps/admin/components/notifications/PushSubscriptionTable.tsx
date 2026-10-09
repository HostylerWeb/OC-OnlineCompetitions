"use client";

import { formatDate } from "@oc/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PushSubscriptionTableProps {
  subscriptions: Array<{
    _id: string;
    endpoint: string;
    userAgent?: string;
    active: boolean;
    createdAt: string;
    userId?: { _id: string; email?: string; firstName?: string; lastName?: string } | null;
  }>;
  onDeactivate: (id: string) => void;
  isLoading: boolean;
}

export function PushSubscriptionTable({
  subscriptions,
  onDeactivate,
  isLoading,
}: PushSubscriptionTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">Loading subscriptions...</div>
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-muted-foreground">No push subscriptions found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Device</TableHead>
          <TableHead>Active</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="w-24">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {subscriptions.map((sub) => (
          <TableRow key={sub._id}>
            <TableCell>
              {sub.userId ? (
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {[sub.userId.firstName, sub.userId.lastName].filter(Boolean).join(" ") ||
                      sub.userId.email ||
                      "Unknown"}
                  </span>
                  {sub.userId.email && (
                    <span className="text-xs text-muted-foreground">{sub.userId.email}</span>
                  )}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Anonymous</span>
              )}
            </TableCell>
            <TableCell>
              <span
                className="block max-w-48 truncate text-sm text-muted-foreground"
                title={sub.userAgent}
              >
                {sub.userAgent || "Unknown"}
              </span>
            </TableCell>
            <TableCell>
              {sub.active ? (
                <Badge className="border-transparent bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  Active
                </Badge>
              ) : (
                <Badge variant="destructive">Inactive</Badge>
              )}
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground">{formatDate(sub.createdAt)}</span>
            </TableCell>
            <TableCell>
              {sub.active ? (
                <Button variant="outline" size="sm" onClick={() => onDeactivate(sub._id)}>
                  Deactivate
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

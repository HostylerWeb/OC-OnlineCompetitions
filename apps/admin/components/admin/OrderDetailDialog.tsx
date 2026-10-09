"use client";

import { useAdminOrder, useAdminOrderMutations } from "@oc/api-admin";
import { User } from "@oc/icons";
import { formatDate, formatOrderNumber } from "@oc/utils";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PriceCell } from "./PriceCell";
import { StatusBadge } from "./StatusBadge";

type PopulatedUserId = { _id: string; id?: string };

function getOrderUserId(userId: string | PopulatedUserId | undefined): string | undefined {
  if (!userId) return undefined;
  if (typeof userId === "string") return userId;
  return userId._id ?? userId.id;
}

interface OrderDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
  onViewCustomer?: (userId: string) => void;
}

const statusVariantMap: Record<string, "warning" | "success" | "error" | "draft"> = {
  pending: "warning",
  processing: "warning",
  failed: "error",
  refunded: "draft",
  completed: "success",
};

const statusOptions = ["pending", "processing", "completed", "failed", "refunded"] as const;

function OrderDetailSkeleton() {
  return (
    <div className="flex flex-col gap-5 px-1 py-2">
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}

export function OrderDetailDialog({
  open,
  onOpenChange,
  orderId,
  onViewCustomer,
}: OrderDetailDialogProps) {
  const { data: orderRes, isLoading, refetch } = useAdminOrder(orderId ?? "");
  const order: any = orderRes?.data ?? null;
  const { updateStatusMutation } = useAdminOrderMutations();
  const [changingStatus, setChangingStatus] = useState(false);

  const orderUserId = getOrderUserId(order?.userId);
  const hasCustomerTrigger = !!orderUserId && !!onViewCustomer;

  if (!open) return null;

  const handleStatusChange = (newStatus: string) => {
    if (!orderId || newStatus === order?.status) return;
    setChangingStatus(true);
    updateStatusMutation.mutate(
      { id: orderId, status: newStatus },
      {
        onSuccess: () => {
          toast.success(`Order status changed to ${newStatus}`);
          refetch();
          setChangingStatus(false);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to update status");
          setChangingStatus(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] w-full max-w-[calc(100%-2rem)] sm:max-w-3xl rounded-lg border p-6">
        <DialogHeader>
          {isLoading ? (
            <DialogTitle>Loading order...</DialogTitle>
          ) : order ? (
            <DialogTitle className="flex items-center gap-3">
              Order {formatOrderNumber(order.orderNumber)}
              <StatusBadge variant={statusVariantMap[order.status] ?? "draft"} showIcon={false}>
                {order.status}
              </StatusBadge>
            </DialogTitle>
          ) : (
            <DialogTitle>Order not found</DialogTitle>
          )}
        </DialogHeader>

        <ScrollArea className="min-h-0">
          {isLoading ? (
            <OrderDetailSkeleton />
          ) : !order ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <p className="text-sm text-muted-foreground">Order not found.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6 px-1 py-2">
              {/* Header bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                {hasCustomerTrigger ? (
                  <button
                    type="button"
                    onClick={() => onViewCustomer(orderUserId!)}
                    className="group flex flex-col gap-0.5 text-left"
                    title="View customer details"
                  >
                    <span className="text-xs text-muted-foreground">Customer</span>
                    <span className="flex items-center gap-1.5 font-medium transition-colors group-hover:text-primary">
                      <User className="size-3.5 shrink-0" />
                      {order.userFullName || order.userEmail || "—"}
                    </span>
                    {order.userEmail && order.userFullName ? (
                      <span className="text-xs text-muted-foreground transition-colors group-hover:text-primary/70">
                        {order.userEmail}
                      </span>
                    ) : null}
                  </button>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Customer</span>
                    <span className="font-medium">
                      {order.userFullName || order.userEmail || "—"}
                    </span>
                    {order.userEmail && order.userFullName ? (
                      <span className="text-xs text-muted-foreground">{order.userEmail}</span>
                    ) : null}
                  </div>
                )}
                <div className="flex flex-col gap-0.5 text-right">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="text-lg font-semibold">
                    <PriceCell value={order.total} />
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 text-right">
                  <span className="text-xs text-muted-foreground">Date</span>
                  <span>{formatDate(order.createdAt)}</span>
                </div>
              </div>

              {/* Status change */}
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Status
                </span>
                <Select
                  value={order.status}
                  onValueChange={handleStatusChange}
                  disabled={changingStatus}
                >
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className="capitalize">{s}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Order Items */}
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Items ({(order as any).orderItems?.length ?? order.items?.length ?? 0})
                </h4>
                {((order as any).orderItems?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No items.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {((order as any).orderItems ?? []).map((item: any) => (
                      <div key={item._id} className="rounded-lg border px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-sm font-medium">
                              {item.competitionId?.title ??
                                item.competitionTitle ??
                                "Unknown competition"}
                            </span>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>Qty: {item.quantity}</span>
                              <span>
                                <PriceCell value={item.unitPrice} /> ea
                              </span>
                              <span className="font-medium text-foreground">
                                <PriceCell value={item.totalPrice} />
                              </span>
                              {item.answerIndex !== undefined ? (
                                <Badge variant="outline" className="text-[10px]">
                                  Answer: {item.answerIndex}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        {item.ticketNumbers && item.ticketNumbers.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.ticketNumbers.slice(0, 20).map((num: number) => (
                              <code
                                key={num}
                                className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold text-gold tabular-nums"
                              >
                                {num}
                              </code>
                            ))}
                            {item.ticketNumbers.length > 20 ? (
                              <span className="inline-flex items-center text-[11px] text-muted-foreground">
                                +{item.ticketNumbers.length - 20} more
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pricing */}
              <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-right font-medium">
                    <PriceCell value={order.subtotal} />
                  </span>
                  {order.discountAmount > 0 ? (
                    <>
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-right font-medium text-green-600">
                        -<PriceCell value={order.discountAmount} />
                      </span>
                    </>
                  ) : null}
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-right font-semibold">
                    <PriceCell value={order.total} />
                  </span>
                  {order.referralBonusTickets > 0 ? (
                    <>
                      <span className="text-muted-foreground">Referral bonus tickets</span>
                      <span className="text-right font-medium">+{order.referralBonusTickets}</span>
                    </>
                  ) : null}
                  {order.referralBalanceUsed > 0 ? (
                    <>
                      <span className="text-muted-foreground">Referral balance used</span>
                      <span className="text-right font-medium">
                        -<PriceCell value={order.referralBalanceUsed} />
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Payment */}
              {order.provider ? (
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Payment
                  </h4>
                  <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <span className="text-muted-foreground">Provider</span>
                      <span className="text-right font-medium capitalize">{order.provider}</span>
                      {order.providerSessionId ? (
                        <>
                          <span className="text-muted-foreground">Session ID</span>
                          <code className="truncate text-right text-xs">
                            {order.providerSessionId}
                          </code>
                        </>
                      ) : null}
                      {order.paidAt ? (
                        <>
                          <span className="text-muted-foreground">Paid at</span>
                          <span className="text-right">{formatDate(order.paidAt)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Shipping address */}
              {order.shippingAddress?.addressLine1 ? (
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Shipping address
                  </h4>
                  <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <span className="text-muted-foreground">Address</span>
                      <span className="text-right font-medium">
                        {order.shippingAddress.addressLine1}
                      </span>
                      {order.shippingAddress.addressLine2 ? (
                        <>
                          <span className="text-muted-foreground">Address line 2</span>
                          <span className="text-right">{order.shippingAddress.addressLine2}</span>
                        </>
                      ) : null}
                      <span className="text-muted-foreground">City</span>
                      <span className="text-right">{order.shippingAddress.city ?? "—"}</span>
                      <span className="text-muted-foreground">Postcode</span>
                      <span className="text-right">{order.shippingAddress.postcode ?? "—"}</span>
                      {order.shippingAddress.country ? (
                        <>
                          <span className="text-muted-foreground">Country</span>
                          <span className="text-right">{order.shippingAddress.country}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Order metadata */}
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Order details
                </h4>
                <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {order.promoCodeId ? (
                      <>
                        <span className="text-muted-foreground">Promo code</span>
                        <span className="text-right font-mono text-xs">{order.promoCodeId}</span>
                      </>
                    ) : null}
                    {order.orderNumber ? (
                      <>
                        <span className="text-muted-foreground">Order number</span>
                        <span className="text-right font-mono text-xs">
                          {formatOrderNumber(order.orderNumber)}
                        </span>
                      </>
                    ) : null}
                    {order.createdAt ? (
                      <>
                        <span className="text-muted-foreground">Created</span>
                        <span className="text-right">{formatDate(order.createdAt)}</span>
                      </>
                    ) : null}
                    {order.updatedAt ? (
                      <>
                        <span className="text-muted-foreground">Updated</span>
                        <span className="text-right">{formatDate(order.updatedAt)}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface OrderPaymentStatusProps {
  orderId: string;
  initialStatus: string;
  providerSessionId: string | null;
  stripeSuccess: boolean;
}

interface CheckoutStatusResponse {
  data?: { status?: string };
}

const TERMINAL_STATUSES = new Set(["paid", "failed", "cancelled"]);

const POLL_INTERVAL_MS = 2_500;
const MAX_ATTEMPTS = 24;

function statusVariant(status: string): "success" | "warning" | "secondary" | "destructive" {
  switch (status) {
    case "paid":
    case "delivered":
      return "success";
    case "pending":
    case "processing":
    case "shipped":
      return "warning";
    case "failed":
    case "cancelled":
    case "refunded":
      return "destructive";
    default:
      return "secondary";
  }
}

export function OrderPaymentStatus({
  orderId,
  initialStatus,
  providerSessionId,
  stripeSuccess,
}: OrderPaymentStatusProps) {
  const [status, setStatus] = useState(initialStatus);
  const [polling, setPolling] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!stripeSuccess || !providerSessionId) return;
    const sessionId = providerSessionId;
    if (TERMINAL_STATUSES.has(status)) return;

    let active = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      if (!active) return;
      attempts += 1;
      setPolling(true);

      let stop = false;
      let gaveUp = false;
      try {
        const res = await fetch(`/api/shop/checkout/status/${encodeURIComponent(sessionId)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          stop = true;
        } else {
          const json = (await res.json().catch(() => null)) as CheckoutStatusResponse | null;
          const next = json?.data?.status;
          if (next) {
            if (active) setStatus(next);
            gaveUp = attempts >= MAX_ATTEMPTS && !TERMINAL_STATUSES.has(next);
            stop = TERMINAL_STATUSES.has(next) || attempts >= MAX_ATTEMPTS;
          } else {
            stop = true;
          }
        }
      } catch {
        stop = true;
      }

      if (!active) return;
      if (stop) {
        setPolling(false);
        if (gaveUp) setTimedOut(true);
        return;
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    }

    void tick();

    return () => {
      active = false;
      setPolling(false);
      setTimedOut(false);
      if (timer) clearTimeout(timer);
    };
  }, [stripeSuccess, providerSessionId, status]);

  const isProcessing = polling && !TERMINAL_STATUSES.has(status);

  return (
    <div className="flex flex-col items-start gap-3">
      <Badge variant={statusVariant(status)}>{status}</Badge>
      {isProcessing ? <p className="text-sm text-muted-foreground">Processing payment…</p> : null}
      {!isProcessing && stripeSuccess && status === "paid" ? (
        <p className="text-sm text-success">Payment received  -  your order is being prepared.</p>
      ) : null}
      {status === "failed" ? (
        <p className="text-sm text-destructive">Payment failed  -  you have not been charged.</p>
      ) : null}
      {timedOut ? (
        <Link
          href={`/orders/${orderId}`}
          className="text-sm text-gold underline underline-offset-4 transition-colors hover:text-gold/80"
        >
          Payment is still processing  -  refresh to check again.
        </Link>
      ) : null}
    </div>
  );
}

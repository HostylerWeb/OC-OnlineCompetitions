"use client";

import {
  type ConversionPostbackLogRow,
  type ConversionPostbackSummaryRow,
  useAdminConversionPostbacks,
  useAdminConversionPostbacksSummary,
} from "@oc/api-admin";
import { type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { DataTable, DataTableColumnHeader } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getTrafficSourceLabel, TRAFFIC_SOURCES } from "./settings-schema";

const EVENT_LABELS: Record<string, string> = {
  signup: "Sign Up",
  purchase: "Purchase",
};

function formatAmount(row: ConversionPostbackLogRow): string {
  return row.amount != null ? `£${row.amount}` : "—";
}

export function PostbackLogsTab() {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [eventType, setEventType] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [trackerId, setTrackerId] = useState<string>("");
  const [days, setDays] = useState<string>("30");
  const [applied, setApplied] = useState<{
    eventType: string;
    source: string;
    status: string;
    trackerId: string;
    days: string;
  }>({ eventType: "", source: "", status: "", trackerId: "", days: "30" });

  const { data, isLoading } = useAdminConversionPostbacks({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    eventType: applied.eventType || undefined,
    source: applied.source || undefined,
    status: applied.status || undefined,
    trackerId: applied.trackerId || undefined,
    days: applied.days,
  });
  const { data: summaryData } = useAdminConversionPostbacksSummary(
    parseInt(applied.days, 10) || 30
  );

  const rows = (data?.data ?? []) as ConversionPostbackLogRow[];
  const summary =
    (summaryData?.data as { rows?: ConversionPostbackSummaryRow[] } | undefined)?.rows ?? [];

  const columns = useMemo<ColumnDef<ConversionPostbackLogRow>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Time" />,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "eventType",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Event" />,
        cell: ({ row }) => (
          <Badge variant="secondary">{EVENT_LABELS[row.original.eventType]}</Badge>
        ),
      },
      {
        accessorKey: "trackerName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Tracker" />,
        cell: ({ row }) => <span className="text-sm">{row.original.trackerName}</span>,
      },
      {
        accessorKey: "source",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Source" />,
        cell: ({ row }) => {
          const s = row.original.source;
          return s ? (
            <Badge variant="outline">{getTrafficSourceLabel(s)}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          );
        },
      },
      {
        accessorKey: "clickId",
        header: "Click ID",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.clickId ?? "—"}</span>,
      },
      {
        accessorKey: "amount",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
        cell: ({ row }) => (
          <span className="text-sm font-medium">{formatAmount(row.original)}</span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const ok = row.original.ok;
          return ok ? <Badge>OK</Badge> : <Badge variant="destructive">Failed</Badge>;
        },
      },
    ],
    []
  );

  const applyFilters = () => {
    setApplied({ eventType, source, status, trackerId, days });
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  return (
    <div className="flex flex-col gap-5">
      <SummaryCards summary={summary} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger>
              <SelectValue placeholder="Event" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All events</SelectItem>
              <SelectItem value="signup">Sign Up</SelectItem>
              <SelectItem value="purchase">Purchase</SelectItem>
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger>
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All sources</SelectItem>
              {TRAFFIC_SOURCES.map((s) => (
                <SelectItem key={s.code} value={s.code}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All statuses</SelectItem>
              <SelectItem value="ok">OK</SelectItem>
              <SelectItem value="fail">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger>
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="0">All time</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input
              value={trackerId}
              onChange={(e) => setTrackerId(e.target.value)}
              placeholder="Tracker ID"
              className="h-9"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={applyFilters}
              data-umami-event="conversion:apply-log-filters"
            >
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        pageCount={Math.ceil((data?.meta?.total ?? 0) / pagination.pageSize) || 1}
        pagination={pagination}
        onPaginationChange={setPagination}
      />
    </div>
  );
}

function SummaryCards({ summary }: { summary: ConversionPostbackSummaryRow[] }) {
  const totals = useMemo(() => {
    const bySource = new Map<
      string,
      { count: number; totalAmount: number; purchases: number; signups: number }
    >();
    const all = { count: 0, totalAmount: 0, purchases: 0, signups: 0 };
    for (const row of summary) {
      const key = row.source ?? "direct";
      const cur = bySource.get(key) ?? { count: 0, totalAmount: 0, purchases: 0, signups: 0 };
      cur.count += row.count;
      cur.totalAmount += row.totalAmount;
      if (row.eventType === "purchase") cur.purchases += row.count;
      else cur.signups += row.count;
      bySource.set(key, cur);

      all.count += row.count;
      all.totalAmount += row.totalAmount;
      if (row.eventType === "purchase") all.purchases += row.count;
      else all.signups += row.count;
    }
    return { bySource, all };
  }, [summary]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Conversions</div>
            <div className="mt-1 text-2xl font-bold">{totals.all.count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Revenue</div>
            <div className="mt-1 text-2xl font-bold">£{totals.all.totalAmount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Purchases</div>
            <div className="mt-1 text-2xl font-bold">{totals.all.purchases}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Signups</div>
            <div className="mt-1 text-2xl font-bold">{totals.all.signups}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Revenue by traffic source</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {totals.bySource.size === 0 ? (
            <p className="text-sm text-muted-foreground">No postbacks logged in this period.</p>
          ) : (
            Array.from(totals.bySource.entries()).map(([code, v]) => (
              <div
                key={code}
                className="flex items-center justify-between border-b border-border/40 py-1.5 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{code}</Badge>
                  <span className="text-sm">{getTrafficSourceLabel(code)}</span>
                </div>
                <div className="text-right text-sm">
                  <span className="font-medium">£{v.totalAmount}</span>
                  <span className="text-muted-foreground"> · {v.count} conv</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

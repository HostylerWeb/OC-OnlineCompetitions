"use client";

import { api, useAdminCompetitions, useAuth } from "@oc/api-admin";
import { Plus, RefreshCw, Settings, X } from "@oc/icons";
import type { AdminCompetition } from "@oc/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  CompetitionDrawDialog,
  DrawCompetitionGrid,
  DrawQueueControls,
  LivestreamDrawHeader,
  RecentWinnersSection,
} from "@/components/livestream";
import type { DrawQueueTabId, RecentWinner, SheetInfo } from "@/components/livestream/types";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface WinnerApiEntry {
  _id: string;
  competitionId: string;
  competitionTitle: string;
  displayName?: string;
  email?: string;
  ticketNumber: string;
  drawnAt: string;
}

interface SheetSettingsData {
  whitelistedEmails: string[];
  driveFolderId: string;
}

function SheetSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [emails, setEmails] = useState<string[]>([]);
  const [driveFolderId, setDriveFolderId] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!open) return;
    async function load() {
      setIsLoading(true);
      try {
        const res = await api.get<SheetSettingsData>("/api/admin/sheet-settings");
        setEmails(res.data?.whitelistedEmails ?? []);
        setDriveFolderId(res.data?.driveFolderId ?? "");
      } catch {
        toast.error("Failed to load sheet settings");
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [open]);

  async function handleAddEmail() {
    const email = newEmail.trim();
    if (!email) return;
    try {
      await api.post("/api/admin/sheet-settings", { email });
      setEmails((prev) => [...prev, email]);
      setNewEmail("");
      toast.success("Email added to whitelist");
    } catch {
      toast.error("Failed to add email");
    }
  }

  async function handleRemoveEmail(email: string) {
    try {
      await api.delete(`/api/admin/sheet-settings/${encodeURIComponent(email)}`);
      setEmails((prev) => prev.filter((e) => e !== email));
      toast.success("Email removed from whitelist");
    } catch {
      toast.error("Failed to remove email");
    }
  }

  async function handleSaveDriveFolder() {
    try {
      await api.post("/api/admin/sheet-settings", { driveFolderId });
      toast.success("Drive folder saved");
    } catch {
      toast.error("Failed to save drive folder");
    }
  }

  async function handleSyncAll() {
    setIsSyncing(true);
    try {
      await api.post("/api/admin/sheet-settings/sync");
      toast.success("All sheets synced");
    } catch {
      toast.error("Failed to sync sheets");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sheet Settings</DialogTitle>
          <DialogDescription>
            Manage Google Drive folder and whitelisted editor emails.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          <div className="space-y-2">
            <span className="text-sm font-medium">Drive Folder ID</span>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. 1BC5zffkPw1aK-TINEFiiKWLdSEgvEgBx"
                value={driveFolderId}
                onChange={(e) => setDriveFolderId(e.target.value)}
              />
              <Button variant="outline" size="icon" onClick={handleSaveDriveFolder}>
                <Plus className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Spreadsheets will be created inside this Drive folder. Leave empty for root.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Whitelisted Editors</span>
            <div className="flex gap-2">
              <Input
                placeholder="email@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleAddEmail();
                }}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleAddEmail}
                disabled={!newEmail.trim()}
                data-umami-event="livestream-studio:sheet-add-email"
              >
                <Plus className="size-4" />
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : emails.length === 0 ? (
                <p className="text-sm text-muted-foreground">No whitelisted emails yet.</p>
              ) : (
                emails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <span className="text-sm">{email}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 shrink-0"
                      onClick={() => handleRemoveEmail(email)}
                      data-umami-event="livestream-studio:sheet-remove-email"
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            onClick={handleSyncAll}
            disabled={isSyncing}
            data-umami-event="livestream-studio:sheet-sync-all"
          >
            {isSyncing ? "Syncing..." : "Sync All Sheets"}
          </Button>
          <Button variant="default" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function LivestreamDrawFullPage() {
  const queryClient = useQueryClient();
  const { role: currentRole } = useAuth();
  const isManager = currentRole === "manager";
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<DrawQueueTabId>("queue");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompetition, setSelectedCompetition] = useState<AdminCompetition | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");
  const [confirmCompetitionId, setConfirmCompetitionId] = useState<string | null>(null);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [endCompetitionId, setEndCompetitionId] = useState<string | null>(null);
  const [endingCompetition, setEndingCompetition] = useState(false);
  const [sheetInfoMap, setSheetInfoMap] = useState<Map<string, SheetInfo>>(new Map());
  const [sheetLoading, setSheetLoading] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [winners, setWinners] = useState<RecentWinner[]>([]);
  const [winnersLoading, setWinnersLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    setCurrentTime(new Date());
    return () => clearInterval(timer);
  }, []);

  const {
    data: competitionsResponse,
    isLoading: isLoadingCompetitions,
    refetch,
  } = useAdminCompetitions({ limit: 100 });

  const competitions = competitionsResponse?.data ?? [];

  const pendingCount = useMemo(
    () => competitions.filter((c) => c.status === "pending_draw").length,
    [competitions]
  );

  const drawnCount = useMemo(
    () => competitions.filter((c) => c.status === "drawn").length,
    [competitions]
  );

  const filteredCompetitions = useMemo(() => {
    let filtered = competitions;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((c) => c.title.toLowerCase().includes(q));
    }
    if (activeTab === "pending_draw") {
      filtered = filtered.filter((c) => c.status === "pending_draw");
    } else if (activeTab === "drawn") {
      filtered = filtered.filter((c) => c.status === "drawn");
    } else if (activeTab === "queue") {
      filtered = filtered.filter((c) => c.status !== "drawn");
    }
    return filtered;
  }, [competitions, searchQuery, activeTab]);

  const showRecent = activeTab === "recent" || activeTab === "completed";

  const fetchWinners = useCallback(async () => {
    setWinnersLoading(true);
    try {
      const res = await api.get<WinnerApiEntry[]>("/api/admin/winners", {
        params: {
          page: 1,
          limit: 10,
          sortField: "drawnAt",
          sortDir: "desc",
        },
      });
      setWinners(
        (res.data ?? []).map((w) => ({
          id: w._id,
          competitionId: w.competitionId,
          competitionTitle: w.competitionTitle,
          winner: {
            id: w._id,
            name: w.displayName ?? w.email ?? "Unknown",
            ticketNumber: w.ticketNumber,
          },
          drawnAt: w.drawnAt,
        }))
      );
    } catch {
      toast.error("Failed to load winners");
    } finally {
      setWinnersLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWinners();
  }, [fetchWinners]);

  const confirmWinnerMutation = useMutation({
    mutationFn: async ({
      competitionId,
      ticketNum,
    }: {
      competitionId: string;
      ticketNum: number;
    }) => api.post("/api/admin/winners", { competitionId, ticketNumber: ticketNum }),
    onSuccess: () => {
      toast.success("Winner confirmed!");
      queryClient.invalidateQueries({ queryKey: ["admin", "competitions"] });
      void fetchWinners();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to confirm winner");
    },
  });

  async function handleConnectGoogle() {
    await fetch("/api/auth/unlink-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId: "google" }),
    }).catch(() => {});

    const res = await fetch("/api/auth/link-social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "google",
        scopes: [
          "openid",
          "profile",
          "email",
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/drive.file",
        ],
        callbackURL: window.location.href,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err?.error?.message ?? "Failed to start Google authentication");
      return;
    }

    const { url } = (await res.json()) as { url: string };
    window.location.href = url;
  }

  function handleSelectCompetition(competitionId: string) {
    const comp = competitions.find((c) => c._id === competitionId) ?? null;
    setSelectedCompetition(comp);
    setNeedsReauth(false);
    setDialogOpen(true);
  }

  function handleDrawWinner(competitionId: string) {
    setDialogOpen(false);
    setConfirmCompetitionId(competitionId);
    setTicketNumber("");
    setConfirmDialogOpen(true);
  }

  function handleRequestEnd(competitionId: string) {
    setEndCompetitionId(competitionId);
    setEndDialogOpen(true);
  }

  function handleConfirmEnd() {
    if (!endCompetitionId) return;
    setEndingCompetition(true);
    api
      .post(`/api/admin/competitions/${endCompetitionId}/end-draw`)
      .then(() => {
        toast.success("Competition ended — purchases are paused");
        void refetch();
        setEndDialogOpen(false);
        setEndCompetitionId(null);
        setDialogOpen(false);
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Failed to end competition");
      })
      .finally(() => setEndingCompetition(false));
  }

  async function handleOpenSheet(competitionId: string): Promise<string | null> {
    setSheetLoading(true);
    try {
      const res = await api.post<SheetInfo & { needsReauth?: boolean }>(
        "/api/admin/livestream/create-sheet",
        { competitionId }
      );
      if (res.data?.needsReauth) {
        setSheetLoading(false);
        setNeedsReauth(true);
        return null;
      }
      if (res.data?.sheetUrl) {
        setSheetInfoMap((prev) => new Map(prev).set(competitionId, res.data!));
        return res.data.sheetUrl;
      }
      toast.error("No sheet URL returned");
      return null;
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ?? err?.message ?? "Failed to create/open sheet";
      toast.error(msg);
      return null;
    } finally {
      setSheetLoading(false);
    }
  }

  function handleConfirmWinner() {
    const parsed = Number.parseInt(ticketNumber, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter a valid ticket number");
      return;
    }
    if (!confirmCompetitionId) return;

    confirmWinnerMutation.mutate(
      { competitionId: confirmCompetitionId, ticketNum: parsed },
      {
        onSettled: () => {
          setConfirmDialogOpen(false);
          setConfirmCompetitionId(null);
          setTicketNumber("");
        },
      }
    );
  }

  function handleRefresh() {
    void refetch();
    void fetchWinners();
    toast.success("Data refreshed");
  }

  const selectedSheetInfo = selectedCompetition
    ? (sheetInfoMap.get(selectedCompetition._id) ?? null)
    : null;

  return (
    <PageShell
      title="Draw Studio"
      description="Livestream draw management with Google Sheets export."
      showBreadcrumbs={false}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsDialogOpen(true)}
            data-umami-event="livestream-studio:sheet-settings"
          >
            <Settings data-icon="inline-start" />
            Sheet Settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            data-umami-event="livestream-studio:refresh"
          >
            <RefreshCw data-icon="inline-start" />
            Refresh
          </Button>
        </div>
      }
    >
      <LivestreamDrawHeader currentTime={currentTime} onRefresh={handleRefresh} />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-8">
        <DrawQueueControls
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as DrawQueueTabId)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filteredCount={filteredCompetitions.length}
          pendingCount={pendingCount}
          drawnCount={drawnCount}
        />

        {showRecent ? (
          <RecentWinnersSection winners={winners} isLoading={winnersLoading} />
        ) : (
          <DrawCompetitionGrid
            competitions={filteredCompetitions}
            isLoading={isLoadingCompetitions}
            searchQuery={searchQuery}
            onSelectCompetition={handleSelectCompetition}
            selectedCompetitionId={selectedCompetition?._id ?? null}
          />
        )}
      </main>

      <CompetitionDrawDialog
        competition={selectedCompetition}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setNeedsReauth(false);
        }}
        onDrawWinner={handleDrawWinner}
        onEndCompetition={handleRequestEnd}
        isEndingCompetition={endingCompetition}
        onOpenSheet={handleOpenSheet}
        onConnectGoogle={handleConnectGoogle}
        needsReauth={needsReauth}
        sheetInfo={selectedSheetInfo}
        isSheetLoading={sheetLoading}
        showSheetTools={!isManager}
      />

      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialogOpen(false);
            setConfirmCompetitionId(null);
            setTicketNumber("");
          }
        }}
        title="Confirm Winner"
        description={
          confirmCompetitionId
            ? `Enter the winning ticket number for ${competitions.find((c) => c._id === confirmCompetitionId)?.title ?? "this competition"}`
            : ""
        }
        confirmLabel="Confirm Winner"
        isLoading={confirmWinnerMutation.isPending}
        onConfirm={handleConfirmWinner}
        confirmDataUmamiEvent="livestream-studio:confirm-winner"
      >
        <Input
          type="number"
          min={1}
          placeholder="Winning entry #"
          value={ticketNumber}
          onChange={(e) => setTicketNumber(e.target.value)}
          className="font-mono"
          autoFocus
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={endDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEndDialogOpen(false);
            setEndCompetitionId(null);
          }
        }}
        title="End Competition"
        description={
          endCompetitionId
            ? `End ${competitions.find((c) => c._id === endCompetitionId)?.title ?? "this competition"} now? This pauses all new ticket purchases so no one buys during the draw. You can still draw the winner and open the spreadsheet, and reopen the competition later from its edit page.`
            : ""
        }
        confirmLabel="End Competition"
        isLoading={endingCompetition}
        onConfirm={handleConfirmEnd}
        destructive
        confirmDataUmamiEvent="livestream-studio:confirm-end-competition"
      />

      <SheetSettingsDialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen} />
    </PageShell>
  );
}

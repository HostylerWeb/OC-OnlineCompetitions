"use client";

import { useBonusAwardAssignmentDrawerStore, useInstantPrizeDrawerStore } from "@oc/api-admin";
import type { AdminCategory } from "@oc/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompetitionDetailsTab } from "./CompetitionDetailsTab";
import { CompetitionFormTabPanel } from "./CompetitionFormTabPanel";
import { CompetitionImagesTab } from "./CompetitionImagesTab";
import { CompetitionInstantPrizesTab } from "./CompetitionInstantPrizesTab";
import { CompetitionMilestonesTab } from "./CompetitionMilestonesTab";
import { CompetitionOptionsTab } from "./CompetitionOptionsTab";
import { CompetitionPrizeTab } from "./CompetitionPrizeTab";
import { CompetitionTicketsTab } from "./CompetitionTicketsTab";
import type { CompetitionFormState } from "./types";
import type { CompetitionFormTab } from "./validateCompetitionForm";

interface CompetitionFormTabsProps {
  form: CompetitionFormState;
  categories: AdminCategory[];
  editingId: string | null;
  isFetching: boolean;
  activeTab: CompetitionFormTab;
  onActiveTabChange: (tab: CompetitionFormTab) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onFormUpdate: (updater: (prev: CompetitionFormState) => CompetitionFormState) => void;
  onUploadsInFlightChange?: (inFlight: boolean) => void;
  onSessionUploadedUrl?: (url: string) => void;
  drawDateError?: string;
  maxTickets?: number;
  ticketsSold?: number;
}

function CompetitionFormTabs({
  form,
  categories,
  editingId,
  isFetching,
  activeTab,
  onActiveTabChange,
  onChange,
  onFormUpdate,
  onUploadsInFlightChange,
  onSessionUploadedUrl,
  drawDateError,
  maxTickets: maxTicketsProp,
  ticketsSold = 0,
}: CompetitionFormTabsProps) {
  if (isFetching) {
    return (
      <div className="flex flex-col gap-4 px-6 py-5">
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    );
  }

  const maxTickets = maxTicketsProp ?? (parseInt(form.maxTickets as unknown as string, 10) || 0);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value: string) => onActiveTabChange(value as CompetitionFormTab)}
      className="flex min-h-0 flex-1 flex-col gap-0"
    >
      <TabsList className="h-auto w-full shrink-0 items-center justify-center overflow-x-auto rounded-none border-b p-[2px] px-3 py-1.5">
        <TabsTrigger value="details" className="flex-none">
          Details
        </TabsTrigger>
        <TabsTrigger value="prize" className="flex-none">
          Prize
        </TabsTrigger>
        <TabsTrigger value="tickets" className="flex-none">
          Tickets
        </TabsTrigger>
        <TabsTrigger value="options" className="flex-none">
          Question
        </TabsTrigger>
        <TabsTrigger value="images" className="flex-none">
          Images
        </TabsTrigger>
        <TabsTrigger value="instant-prizes" className="flex-none">
          Instant Prizes
        </TabsTrigger>
        <TabsTrigger value="milestones" className="flex-none">
          Milestones
        </TabsTrigger>
      </TabsList>

      <TabsContent value="details" className="mt-0 min-h-0 flex-1 overflow-hidden">
        <CompetitionFormTabPanel>
          <CompetitionDetailsTab
            form={form}
            categories={categories}
            onChange={onChange}
            onFormUpdate={onFormUpdate}
          />
        </CompetitionFormTabPanel>
      </TabsContent>

      <TabsContent value="prize" className="mt-0 min-h-0 flex-1 overflow-hidden">
        <CompetitionFormTabPanel>
          <CompetitionPrizeTab
            form={form}
            onChange={onChange}
            onFormUpdate={onFormUpdate}
            drawDateError={drawDateError}
          />
        </CompetitionFormTabPanel>
      </TabsContent>

      <TabsContent value="tickets" className="mt-0 min-h-0 flex-1 overflow-hidden">
        <CompetitionFormTabPanel>
          <CompetitionTicketsTab form={form} onChange={onChange} onFormUpdate={onFormUpdate} />
        </CompetitionFormTabPanel>
      </TabsContent>

      <TabsContent value="options" className="mt-0 min-h-0 flex-1 overflow-hidden">
        <CompetitionFormTabPanel>
          <CompetitionOptionsTab form={form} onChange={onChange} onFormUpdate={onFormUpdate} />
        </CompetitionFormTabPanel>
      </TabsContent>

      <TabsContent value="images" className="mt-0 min-h-0 flex-1 overflow-hidden">
        <CompetitionFormTabPanel>
          <CompetitionImagesTab
            form={form}
            onFormUpdate={onFormUpdate}
            onUploadsInFlightChange={onUploadsInFlightChange}
            onSessionUploadedUrl={onSessionUploadedUrl}
          />
        </CompetitionFormTabPanel>
      </TabsContent>

      <TabsContent value="instant-prizes" className="mt-0 min-h-0 flex-1 overflow-hidden">
        <CompetitionFormTabPanel>
          {!editingId ? (
            <Alert>
              <AlertDescription>
                Save the competition first to assign instant prizes.
              </AlertDescription>
            </Alert>
          ) : (
            <CompetitionInstantPrizesTab
              competitionId={editingId}
              maxTickets={maxTickets}
              onAddPrize={() => {
                useInstantPrizeDrawerStore.getState().openCreate(editingId, maxTickets);
              }}
              onEditPrize={(cip) => {
                useInstantPrizeDrawerStore.getState().openEdit(editingId, maxTickets, cip);
              }}
            />
          )}
        </CompetitionFormTabPanel>
      </TabsContent>
      <TabsContent value="milestones" className="mt-0 min-h-0 flex-1 overflow-hidden">
        <CompetitionFormTabPanel>
          {!editingId ? (
            <Alert>
              <AlertDescription>
                Save the competition first to configure milestones.
              </AlertDescription>
            </Alert>
          ) : (
            <CompetitionMilestonesTab
              competitionId={editingId}
              maxTickets={maxTickets}
              onAddBonus={() =>
                useBonusAwardAssignmentDrawerStore
                  .getState()
                  .open({ competitionId: editingId, maxTickets, ticketsSold })
              }
              onEditBonus={(award) =>
                useBonusAwardAssignmentDrawerStore.getState().edit({
                  assignmentId: award._id,
                  competitionId: editingId,
                  maxTickets,
                  ticketsSold,
                })
              }
            />
          )}
        </CompetitionFormTabPanel>
      </TabsContent>
    </Tabs>
  );
}

export { CompetitionFormTabs };

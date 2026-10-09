"use client";

import {
  useAdminUser,
  useAdminUserBalance,
  useAdminUserCompliance,
  useAdminUserReferralMutation,
  useAdminUserReferralPurchases,
  useAdminUserReferralStats,
  useAuth,
} from "@oc/api-admin";
import { FileText, Pencil, Shield, User } from "@oc/icons";
import type { AdminReferralPurchase, Profile } from "@oc/types";
import { getDisplayName } from "@oc/utils";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { UserCompliancePanel } from "@/components/UserCompliancePanel";
import { FormSheet } from "@/components/FormSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createZodResolver } from "@/lib/zod-resolver";
import { CustomerBalanceSection } from "./CustomerBalanceSection";
import { CustomerComplianceSection } from "./CustomerComplianceSection";
import { CustomerOrdersSection } from "./CustomerOrdersSection";
import { CustomerProfileEditPanel } from "./CustomerProfileEditPanel";
import { CustomerProfileSection } from "./CustomerProfileSection";
import { CustomerReferralHistory } from "./CustomerReferralHistory";
import { CustomerReferralSection } from "./CustomerReferralSection";
import { CustomerWinsSection } from "./CustomerWinsSection";

export interface CustomerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}

function CustomerSheetSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-4">
        <Skeleton className="size-16 shrink-0 rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

export function CustomerSheet({ open, onOpenChange, userId }: CustomerSheetProps) {
  const { role: currentRole } = useAuth();
  const isManager = currentRole === "manager";
  const { data: profileRes, isLoading: profileLoading } = useAdminUser(userId ?? "");
  const { data: referralStatsRes } = useAdminUserReferralStats(userId ?? "");
  const { data: complianceRes, isLoading: complianceLoading } = useAdminUserCompliance(
    userId ?? "",
    { enabled: !!userId && open && !isManager }
  );
  const { data: balanceRes, isLoading: balanceLoading } = useAdminUserBalance(userId ?? "", {
    enabled: !!userId && open && !isManager,
  });
  const { data: referralPurchasesRes, isLoading: referralPurchasesLoading } =
    useAdminUserReferralPurchases(userId ?? "", { enabled: !!userId && open });

  const referralPurchases = (referralPurchasesRes?.data ?? []) as AdminReferralPurchase[];
  const customer = profileLoading ? null : ((profileRes?.data ?? null) as Profile | null);
  const referralStats = referralStatsRes?.data ?? null;

  const displayName = customer
    ? getDisplayName(
        {
          firstName: customer.firstName ?? undefined,
          lastName: customer.lastName ?? undefined,
        },
        customer.email ?? ""
      )
    : "Customer";

  const [reassignUserId, setReassignUserId] = useState<string | null>(null);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const handleReassignReferral = useCallback((uid: string) => {
    setReassignUserId(uid);
    setReassignDialogOpen(true);
  }, []);

  const reassignMutation = useAdminUserReferralMutation();

  const reassignSchema = z.object({
    referralCode: z.string().optional(),
    action: z.enum(["set", "clear"]).default("set"),
  });
  type ReassignFormValues = z.infer<typeof reassignSchema>;

  const reassignForm = useForm<ReassignFormValues>({
    resolver: createZodResolver(reassignSchema),
    defaultValues: { referralCode: "", action: "set" },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(90vh,880px)] w-[min(96vw,56rem)] max-w-none flex-col gap-0 p-0"
        aria-describedby={undefined}
      >
        <DialogHeader className="border-b border-border/60 px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-lg">Customer profile</DialogTitle>
              <DialogDescription className="mt-1 truncate">
                {profileLoading ? "Loading…" : displayName}
              </DialogDescription>
            </div>
            {customer ? (
              <div className="flex flex-wrap gap-1.5">
                {customer.isVerified ? (
                  <Badge variant="secondary" className="border-gold/30 text-gold">
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="outline">Unverified</Badge>
                )}
                {customer.isGuestCheckout ? <Badge variant="outline">Guest checkout</Badge> : null}
                {customer.isAdmin ? <Badge variant="outline">Admin</Badge> : null}
              </div>
            ) : null}
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1 px-6 py-4">
          {profileLoading ? (
            <CustomerSheetSkeleton />
          ) : customer && userId ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
              <TabsList className="mb-4 grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-4">
                <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
                  <User className="size-3.5 shrink-0" aria-hidden="true" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="edit" className="gap-1.5 text-xs sm:text-sm">
                  <Pencil className="size-3.5 shrink-0" aria-hidden="true" />
                  Edit
                </TabsTrigger>
                <TabsTrigger value="activity" className="gap-1.5 text-xs sm:text-sm">
                  <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                  Activity
                </TabsTrigger>
                {!isManager ? (
                  <TabsTrigger value="compliance" className="gap-1.5 text-xs sm:text-sm">
                    <Shield className="size-3.5 shrink-0" aria-hidden="true" />
                    Compliance
                  </TabsTrigger>
                ) : null}
              </TabsList>

              <TabsContent value="overview" className="mt-0 flex flex-col gap-6">
                <CustomerProfileSection customer={customer} />
                {!isManager ? (
                  <CustomerBalanceSection
                    balance={balanceRes?.data ?? null}
                    isLoading={balanceLoading}
                  />
                ) : null}
                <CustomerReferralSection
                  customer={customer}
                  referralStats={referralStats}
                  onReassignReferral={isManager ? undefined : handleReassignReferral}
                />
                {!isManager ? (
                  <CustomerComplianceSection
                    compliance={complianceRes?.data ?? null}
                    isLoading={complianceLoading}
                  />
                ) : null}
              </TabsContent>

              <TabsContent value="edit" className="mt-0">
                {!isManager ? (
                  <CustomerProfileEditPanel
                    userId={userId}
                    profile={customer}
                    balance={balanceRes?.data ?? null}
                    balanceLoading={balanceLoading}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Profile editing is not available for manager accounts.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="activity" className="mt-0 flex flex-col gap-6">
                <CustomerReferralHistory
                  purchases={referralPurchases}
                  isLoading={referralPurchasesLoading}
                />
                <CustomerOrdersSection customerId={customer._id} />
                <CustomerWinsSection customerId={customer._id} />
              </TabsContent>

              {!isManager ? (
                <TabsContent value="compliance" className="mt-0 min-w-0">
                  <UserCompliancePanel userId={userId} hideQuickActions />
                </TabsContent>
              ) : null}
            </Tabs>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <p className="text-sm text-muted-foreground">No customer data available.</p>
            </div>
          )}
        </ScrollArea>

        <FormSheet
          open={reassignDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setReassignDialogOpen(false);
              setReassignUserId(null);
            }
          }}
          title="Reassign referral"
          onSubmit={reassignForm.handleSubmit((values) => {
            if (!reassignUserId) return;
            if (values.action === "clear") {
              reassignMutation.mutate(
                { userId: reassignUserId, action: "clear" as const },
                {
                  onSuccess: () => {
                    toast.success(`Referral cleared for ${customer?.email ?? "user"}`);
                    setReassignDialogOpen(false);
                    setReassignUserId(null);
                  },
                  onError: (err) => {
                    const msg = err instanceof Error ? err.message : "Failed";
                    toast.error(`Referral update failed: ${msg}`);
                  },
                }
              );
            } else if (values.referralCode) {
              reassignMutation.mutate(
                { userId: reassignUserId, referralCode: values.referralCode },
                {
                  onSuccess: () => {
                    toast.success(`Referral reassigned to ${values.referralCode}`);
                    setReassignDialogOpen(false);
                    setReassignUserId(null);
                  },
                  onError: (err) => {
                    const msg = err instanceof Error ? err.message : "Failed";
                    toast.error(`Referral update failed: ${msg}`);
                  },
                }
              );
            }
          })}
          isSubmitting={reassignMutation.isPending}
          submitLabel="Save"
        >
          <Form {...reassignForm}>
            <FormField
              control={reassignForm.control}
              name="action"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Action</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="set">Set referral code</SelectItem>
                      <SelectItem value="clear">Clear referral</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {reassignForm.watch("action") === "set" && (
              <FormField
                control={reassignForm.control}
                name="referralCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New referral code</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter referral code..." {...field} />
                    </FormControl>
                    <FormDescription>
                      This user will be reassigned to this referral code.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </Form>
        </FormSheet>

        <DialogFooter className="border-t border-border/60 px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

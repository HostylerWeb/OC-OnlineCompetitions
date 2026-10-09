import { Profile } from "@oc/api-db/models";
import { sendEmail } from "@oc/api-email/client";
import { getEmailConfig } from "@oc/api-email/config";
import { ReferralTicketsAllocatedEmail } from "@oc/api-email/templates/referral-tickets-allocated";
import { ReferralTicketsAwardedEmail } from "@oc/api-email/templates/referral-tickets-awarded";
import { ReferralTicketsRedeemedEmail } from "@oc/api-email/templates/referral-tickets-redeemed";
import { getCurrentContext } from "@oc/api-infra/env";
import { render } from "@react-email/render";

interface SendReferralTicketsRedeemedEmailParams {
  userId: string;
  competitionTitle: string;
  quantityRedeemed: number;
  ticketNumbers: number[];
  walletBalance: number;
}

export async function sendReferralTicketsRedeemedEmail(
  params: SendReferralTicketsRedeemedEmailParams
): Promise<void> {
  const profile = await Profile.findById(params.userId).lean();
  if (!profile?.email) return;

  const userName = profile.firstName
    ? `${profile.firstName}${profile.lastName ? ` ${profile.lastName}` : ""}`
    : profile.email.split("@")[0] || "Customer";

  try {
    const settings = await getEmailConfig();
    const { frontendUrl } = getCurrentContext();
    const ticketsUrl = `${frontendUrl}/tickets`;
    const emailHtml = await render(
      ReferralTicketsRedeemedEmail({
        userName,
        competitionTitle: params.competitionTitle,
        quantityRedeemed: params.quantityRedeemed,
        ticketNumbers: params.ticketNumbers,
        walletBalance: params.walletBalance,
        ticketsUrl,
        settings,
        frontendUrl,
      })
    );
    await sendEmail({
      to: profile.email,
      subject: "Your referral tickets have been redeemed — Online Competitions",
      html: emailHtml,
    });
  } catch (emailErr) {
    console.error("Failed to send referral tickets redeemed email:", emailErr);
  }
}

interface SendReferralTicketsAwardedEmailParams {
  referrerUserId: string;
  ticketsGranted: number;
  tierLabel: string;
  referrerName: string;
  referrerEmail: string;
}

export async function sendReferralTicketsAwardedEmail(
  params: SendReferralTicketsAwardedEmailParams
): Promise<void> {
  try {
    const settings = await getEmailConfig();
    const { frontendUrl } = getCurrentContext();

    const emailHtml = await render(
      ReferralTicketsAwardedEmail({
        userName: params.referrerName,
        ticketsAwarded: params.ticketsGranted,
        currentTier: params.tierLabel || undefined,
        ticketsUrl: `${frontendUrl}/dashboard/referrals`,
        settings,
        frontendUrl,
      })
    );

    await sendEmail({
      to: params.referrerEmail,
      subject: "You've earned referral tickets! — Online Competitions",
      html: emailHtml,
    });
  } catch (emailErr) {
    console.error("Failed to send referral award email:", emailErr);
  }
}

export async function sendReferralTicketsAllocatedEmail(params: {
  referrerUserId: string;
  referrerName: string;
  referrerEmail: string;
  totalTickets: number;
  competitionCount: number;
  allocations: Array<{
    competitionId: string;
    competitionTitle: string;
    ticketNumbers: number[];
    qty: number;
  }>;
  tierLabel: string;
}): Promise<void> {
  try {
    const settings = await getEmailConfig();
    const { frontendUrl } = getCurrentContext();

    const emailHtml = await render(
      ReferralTicketsAllocatedEmail({
        userName: params.referrerName,
        totalTickets: params.totalTickets,
        competitionCount: params.competitionCount,
        allocation: params.allocations,
        currentTier: params.tierLabel || undefined,
        ticketsUrl: `${frontendUrl}/dashboard/tickets`,
        settings,
        frontendUrl,
      })
    );

    await sendEmail({
      to: params.referrerEmail,
      subject: `You've earned ${params.totalTickets} referral tickets across ${params.competitionCount} competitions — Online Competitions`,
      html: emailHtml,
    });
  } catch (emailErr) {
    console.error("Failed to send referral tickets allocated email:", emailErr);
  }
}

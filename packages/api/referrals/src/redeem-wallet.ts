import { Competition, Profile } from "@oc/api-db/models";
import { countEffectiveOwnedForCap } from "@oc/api-tickets/ticket-service";

export interface ValidateReferralTicketSpendParams {
  userId: string;
  competitionId: string;
  quantity: number;
  walletBalance?: number;
  existingCartQty?: number;
}

export type ReferralTicketValidationError =
  | "COMPETITION_NOT_FOUND"
  | "COMPETITION_INACTIVE"
  | "COMPETITION_ENDED"
  | "INSUFFICIENT_BALANCE"
  | "TICKETS_SOLD_OUT"
  | "MAX_TICKETS_EXCEEDED";

export async function validateReferralTicketSpend(
  params: ValidateReferralTicketSpendParams
): Promise<{ ok: true } | { ok: false; code: ReferralTicketValidationError; message: string }> {
  const { userId, competitionId, quantity, existingCartQty = 0 } = params;

  if (quantity <= 0) {
    return { ok: false, code: "INSUFFICIENT_BALANCE", message: "Quantity must be positive" };
  }

  const competition = await Competition.findById(competitionId).lean();
  if (!competition) {
    return { ok: false, code: "COMPETITION_NOT_FOUND", message: "Competition not found" };
  }

  const now = new Date();
  if (competition.status !== "active") {
    return { ok: false, code: "COMPETITION_INACTIVE", message: "Competition is not active" };
  }
  const { isOpenForTicketSales } = await import("@oc/api-tickets/competition-sales");
  if (!isOpenForTicketSales(competition, now)) {
    return { ok: false, code: "COMPETITION_ENDED", message: "Competition has ended" };
  }

  const profile = await Profile.findById(userId).lean();
  const balance = params.walletBalance ?? profile?.referralTierAwardedTickets ?? 0;
  if (balance < quantity) {
    return {
      ok: false,
      code: "INSUFFICIENT_BALANCE",
      message: `Insufficient wallet tickets. You have ${balance} but need ${quantity}`,
    };
  }

  if (competition.maxTicketsPerUser > 0) {
    const userOwned = await countEffectiveOwnedForCap(competitionId, userId);
    const combined = existingCartQty + quantity;
    if (userOwned + combined > competition.maxTicketsPerUser) {
      return {
        ok: false,
        code: "MAX_TICKETS_EXCEEDED",
        message: `Combined ${combined} tickets (${existingCartQty} in cart + ${quantity} wallet) would exceed your per-user limit of ${competition.maxTicketsPerUser}.`,
      };
    }
  }

  try {
    const { checkTicketAvailability } = await import("@oc/api-tickets/cart");
    await checkTicketAvailability(competitionId, quantity, userId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already have") && msg.includes("Maximum allowed")) {
      return { ok: false, code: "MAX_TICKETS_EXCEEDED", message: msg };
    }
    if (msg.includes("Only ") && msg.includes(" tickets available")) {
      return { ok: false, code: "TICKETS_SOLD_OUT", message: msg };
    }
    return { ok: false, code: "TICKETS_SOLD_OUT", message: msg };
  }

  return { ok: true };
}

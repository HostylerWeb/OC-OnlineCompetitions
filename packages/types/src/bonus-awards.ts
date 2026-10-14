import type { MilestonePrizeCategory } from "./milestone-prize-setup";

export type { MilestonePrizeCategory, MilestonePrizeSetup } from "./milestone-prize-setup";
export {
  milestonePrizeFieldsToSetup,
  milestonePrizeSetupLabel,
  milestonePrizeSetupToFields,
} from "./milestone-prize-setup";

// ─── Admin types ──────────────────────────────────────────────────────────────

export interface AdminBonusAward {
  _id: string;
  // Template data (owned by BonusAward)
  title: string;
  description?: string;
  value?: number;
  images: string[];
  isActive: boolean;
  type: "prize" | "competition_ticket";
  prizeCategory?: MilestonePrizeCategory;
  linkedCompetitionId?: string;
  linkedCompetition?: { title: string; imageUrl?: string; status?: string };
  ticketCount?: number;
  // Optional cross-link for traceability when cloned from instant prize
  sourceInstantPrizeId?: string;
  // Aggregated stats
  totalAssignments: number;
  totalWins: number;
  // Metadata
  createdAt: string;
  updatedAt?: string;
}

export interface AdminBonusAwardAssignmentWin {
  _id: string;
  userId: string;
  userEmail: string;
  ticketNumber: number;
  prizeTitle: string;
  prizeValue: number;
  claimed: boolean;
  claimedAt?: string;
  wonAt: string;
}

export interface AdminBonusAwardAssignment {
  _id: string;
  competitionId: string;
  competitionTitle?: string;
  bonusAwardId: string;
  bonusAward?: AdminBonusAward;
  milestonePct: number;
  thresholdNumber: number;
  quantity: number;
  wonCount: number;
  firedAt?: string;
  firedStatus?: "pending" | "drawn" | "no_eligible_tickets" | "failed";
  isArchived: boolean;
  wins?: AdminBonusAwardAssignmentWin[];
  createdAt: string;
  updatedAt?: string;
}

export interface AdminBonusAwardWinItem {
  _id: string;
  assignmentId: string;
  bonusAwardId: string;
  bonusAwardFireId: string;
  competitionId: string;
  competitionTitle: string;
  milestonePct: number;
  userId: string;
  userEmail: string;
  ticketNumber: number;
  prizeTitle: string;
  prizeValue: number;
  prizeImage?: string;
  wonAt: string;
  notifiedAt?: string;
  claimed: boolean;
  claimedAt?: string;
}

export interface PublicBonusAwardEntry {
  assignment: {
    _id: string;
    milestonePct: number;
    thresholdNumber: number;
    quantity: number;
    wonCount: number;
    firedAt?: string;
  };
  bonusAward: {
    _id: string;
    title: string;
    description?: string;
    value?: number;
    images: string[];
    type: "prize" | "competition_ticket";
    prizeCategory?: MilestonePrizeCategory;
    ticketCount?: number;
  };
}

export interface PublicBonusAwardWinDTO {
  id: string;
  competitionId: string;
  ticketNumber: number;
  milestonePct: number;
  displayName?: string;
  location?: string;
  wonAt: string;
  prizeTitle: string;
  prizeValue: number;
  prizeImage?: string;
  claimed: boolean;
}

export interface BonusAwardCapacityResponse {
  competitionId: string;
  maxTickets: number;
  maxMilestones: number;
  usedMilestones: number;
  availableMilestones: number;
  usedPcts: number[];
  firedCount: number;
}

export interface CreateBonusAwardPayload {
  title: string;
  description?: string;
  value?: number;
  images?: string[];
  isActive?: boolean;
  type?: "prize" | "competition_ticket";
  prizeCategory?: MilestonePrizeCategory;
  linkedCompetitionId?: string;
  ticketCount?: number;
  sourceInstantPrizeId?: string;
}

export interface UpdateBonusAwardPayload {
  title?: string;
  description?: string;
  value?: number;
  images?: string[];
  isActive?: boolean;
  type?: "prize" | "competition_ticket";
  prizeCategory?: MilestonePrizeCategory | null;
  linkedCompetitionId?: string;
  ticketCount?: number;
}

export interface CreateAssignmentPayload {
  bonusAwardId: string;
  milestonePct: number;
  quantity?: number;
}

export interface UpdateAssignmentPayload {
  milestonePct?: number;
  quantity?: number;
  isArchived?: boolean;
}

export interface BonusAwardFireDTO {
  _id: string;
  assignmentId: string;
  bonusAwardId: string;
  competitionId: string;
  milestonePct: number;
  ticketsSoldAtFire: number;
  firedAt: string;
  status: string;
  drawnAt?: string;
}

export interface BonusAwardWinToggleClaimedPayload {
  claimed: boolean;
}

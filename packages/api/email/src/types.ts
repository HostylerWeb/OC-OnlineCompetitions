import type { IEmailSettings } from "@oc/api-db/models/EmailSettings";

export type OrderItem = {
  competitionTitle: string;
  quantity: number;
  unitPrice: number;
  ticketNumbers: number[];
  totalPrice: number;
};

export type WinItem = {
  prizeTitle: string;
  prizeImage?: string;
  prizeValue?: number;
  ticketNumber: number;
  competitionName?: string;
};

export type BonusDrawWinItem = {
  prizeTitle: string;
  prizeValue?: number;
  prizeImage?: string;
  ticketNumber: number;
  competitionName?: string;
  competitionId?: string;
  milestonePct: number;
};

export type EmailTemplateProps = {
  userName?: string;
  settings?: IEmailSettings;
  frontendUrl?: string;
  isGuest?: boolean;

  /** order-confirmation */
  orderId?: string;
  orderNumber?: number;
  orderDate?: string;
  items?: OrderItem[];
  subtotal?: number;
  discount?: number;
  total?: number;

  /** win-notification / instant-win */
  competitionName?: string;
  prizeTitle?: string;
  prizeValue?: number;
  claimUrl?: string;
  prizeImage?: string;
  ticketNumber?: number;
  wins?: WinItem[];

  /** welcome / email-verification */
  code?: string;
  verificationUrl?: string;

  /** referral-tickets-redeemed */
  competitionTitle?: string;
  quantityRedeemed?: number;
  ticketNumbers?: number[];
  walletBalance?: number;
  ticketsUrl?: string;

  /** referral-tickets-awarded */
  ticketsAwarded?: number;
  currentTier?: string;

  /** referral-tickets-allocated */
  totalTickets?: number;
  competitionCount?: number;
  allocation?: Array<{
    competitionId: string;
    competitionTitle: string;
    ticketNumbers: number[];
    qty: number;
  }>;

  /** contact-notification */
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  submittedAt?: string;

  /** password-reset */
  resetUrl?: string;

  /** magic-link-sign-in */
  signInUrl?: string;

  /** admin-emergency */
  recoveryUrl?: string;

  /** bonus-draw-win */
  milestonePct?: number;
  bonusPrizeTitle?: string;
  bonusPrizeValue?: number;
};

/**
 * Shared admin table configuration — single source of truth for which columns
 * are sortable, searchable, and filterable across FE and BE.
 *
 * Usage:
 *   // BE: import sortable fields for parseSort
 *   import { ADMIN_PROMO_CODE_SORTABLE } from "@oc/types";
 *
 *   // FE: import config to build column defs and validate params
 *   import { ADMIN_PROMO_CODE_TABLE } from "@oc/types";
 */

/* ─── Field unions ─────────────────────────────────────────────────────────── */

export const ADMIN_USER_SORTABLE_FIELDS = [
  "email",
  "firstName",
  "lastName",
  "isAdmin",
  "isVerified",
  "createdAt",
  "referralMultiplier",
] as const;
export type AdminUserSortableField = (typeof ADMIN_USER_SORTABLE_FIELDS)[number];

export const ADMIN_USER_SEARCHABLE_FIELDS = ["email", "firstName", "lastName"] as const;
export type AdminUserSearchableField = (typeof ADMIN_USER_SEARCHABLE_FIELDS)[number];

export const ADMIN_ORDER_SORTABLE_FIELDS = [
  "orderNumber",
  "status",
  "total",
  "createdAt",
  "paidAt",
  "userEmail",
] as const;
export type AdminOrderSortableField = (typeof ADMIN_ORDER_SORTABLE_FIELDS)[number];

export const ADMIN_ORDER_SEARCHABLE_FIELDS = [
  "orderNumber",
  "userEmail",
  "userFullName",
  "providerSessionId",
] as const;
export type AdminOrderSearchableField = (typeof ADMIN_ORDER_SEARCHABLE_FIELDS)[number];

export const ADMIN_COMPETITION_SORTABLE_FIELDS = [
  "title",
  "slug",
  "status",
  "category",
  "prizeValue",
  "ticketPrice",
  "maxTickets",
  "drawDate",
  "createdAt",
  "ticketsSold",
] as const;
export type AdminCompetitionSortableField = (typeof ADMIN_COMPETITION_SORTABLE_FIELDS)[number];

export const ADMIN_COMPETITION_SEARCHABLE_FIELDS = [
  "title",
  "slug",
  "shortDescription",
  "description",
  "category",
  "status",
] as const;
export type AdminCompetitionSearchableField = (typeof ADMIN_COMPETITION_SEARCHABLE_FIELDS)[number];

export const ADMIN_CATEGORY_SORTABLE_FIELDS = [
  "name",
  "slug",
  "label",
  "displayOrder",
  "isActive",
  "createdAt",
] as const;
export type AdminCategorySortableField = (typeof ADMIN_CATEGORY_SORTABLE_FIELDS)[number];

export const ADMIN_CATEGORY_SEARCHABLE_FIELDS = ["name", "slug", "label", "isActive"] as const;
export type AdminCategorySearchableField = (typeof ADMIN_CATEGORY_SEARCHABLE_FIELDS)[number];

export const ADMIN_PROMO_CODE_SORTABLE_FIELDS = [
  "code",
  "discountType",
  "discountValue",
  "isActive",
  "maxUses",
  "currentUses",
  "minTickets",
  "validUntil",
  "validFrom",
  "createdAt",
] as const;
export type AdminPromoCodeSortableField = (typeof ADMIN_PROMO_CODE_SORTABLE_FIELDS)[number];

export const ADMIN_PROMO_CODE_SEARCHABLE_FIELDS = ["code", "discountType"] as const;
export type AdminPromoCodeSearchableField = (typeof ADMIN_PROMO_CODE_SEARCHABLE_FIELDS)[number];

export const ADMIN_INSTANT_PRIZE_SORTABLE_FIELDS = [
  "title",
  "value",
  "isActive",
  "type",
  "createdAt",
] as const;
export type AdminInstantPrizeSortableField = (typeof ADMIN_INSTANT_PRIZE_SORTABLE_FIELDS)[number];

export const ADMIN_INSTANT_PRIZE_SEARCHABLE_FIELDS = ["title", "description", "type"] as const;
export type AdminInstantPrizeSearchableField =
  (typeof ADMIN_INSTANT_PRIZE_SEARCHABLE_FIELDS)[number];

export const ADMIN_WINNER_SORTABLE_FIELDS = [
  "ticketNumber",
  "prizeValue",
  "claimed",
  "drawnAt",
  "createdAt",
  "email",
  "competitionTitle",
] as const;
export type AdminWinnerSortableField = (typeof ADMIN_WINNER_SORTABLE_FIELDS)[number];

export const ADMIN_WINNER_SEARCHABLE_FIELDS = ["ticketNumber", "displayName"] as const;
export type AdminWinnerSearchableField = (typeof ADMIN_WINNER_SEARCHABLE_FIELDS)[number];

export const ADMIN_BALANCE_SORTABLE_FIELDS = [
  "available",
  "pending",
  "currency",
  "createdAt",
] as const;
export type AdminBalanceSortableField = (typeof ADMIN_BALANCE_SORTABLE_FIELDS)[number];

export const ADMIN_BALANCE_SEARCHABLE_FIELDS = ["email", "firstName", "currency"] as const;
export type AdminBalanceSearchableField = (typeof ADMIN_BALANCE_SEARCHABLE_FIELDS)[number];

export const ADMIN_REFERRAL_SORTABLE_FIELDS = [
  "email",
  "firstName",
  "lastName",
  "createdAt",
  "totalSpent",
  "isActive",
] as const;
export type AdminReferralSortableField = (typeof ADMIN_REFERRAL_SORTABLE_FIELDS)[number];

export const ADMIN_REFERRAL_SEARCHABLE_FIELDS = ["email", "firstName", "lastName"] as const;
export type AdminReferralSearchableField = (typeof ADMIN_REFERRAL_SEARCHABLE_FIELDS)[number];

export const ADMIN_REFERRAL_PURCHASE_SORTABLE_FIELDS = [
  "referrerEmail",
  "referredEmail",
  "commissionAmount",
  "purchaseCount",
  "purchasedAt",
  "createdAt",
  "isActive",
  "referrerReferralCount",
  "referrerActiveCount",
  "referrerInactiveCount",
  "referrerTotalCount",
] as const;
export type AdminReferralPurchaseSortableField =
  (typeof ADMIN_REFERRAL_PURCHASE_SORTABLE_FIELDS)[number];

export const ADMIN_REFERRAL_PURCHASE_SEARCHABLE_FIELDS = [
  "referrerEmail",
  "referredEmail",
] as const;
export type AdminReferralPurchaseSearchableField =
  (typeof ADMIN_REFERRAL_PURCHASE_SEARCHABLE_FIELDS)[number];

export const ADMIN_INSTANT_PRIZE_WIN_SORTABLE_FIELDS = [
  "wonAt",
  "claimedAt",
  "ticketNumber",
  "claimed",
  "prizeTitle",
  "prizeValue",
  "prizeType",
  "competitionTitle",
  "userEmail",
  "entryNumber",
] as const;
export type AdminInstantPrizeWinSortableField =
  (typeof ADMIN_INSTANT_PRIZE_WIN_SORTABLE_FIELDS)[number];

export const ADMIN_INSTANT_PRIZE_WIN_SEARCHABLE_FIELDS = [
  "ticketNumber",
  "userEmail",
  "prizeTitle",
  "competitionTitle",
] as const;
export type AdminInstantPrizeWinSearchableField =
  (typeof ADMIN_INSTANT_PRIZE_WIN_SEARCHABLE_FIELDS)[number];

export const ADMIN_COMPETITION_INSTANT_PRIZE_SORTABLE_FIELDS = [
  "createdAt",
  "quantity",
  "claimedCount",
  "competitionTitle",
  "prizeTitle",
  "prizeValue",
] as const;
export type AdminCompetitionInstantPrizeSortableField =
  (typeof ADMIN_COMPETITION_INSTANT_PRIZE_SORTABLE_FIELDS)[number];

export const ADMIN_SHOP_CATEGORY_SORTABLE_FIELDS = [
  "name",
  "slug",
  "sortOrder",
  "isActive",
  "createdAt",
] as const;
export type AdminShopCategorySortableField = (typeof ADMIN_SHOP_CATEGORY_SORTABLE_FIELDS)[number];

export const ADMIN_SHOP_CATEGORY_SEARCHABLE_FIELDS = ["name", "slug"] as const;
export type AdminShopCategorySearchableField =
  (typeof ADMIN_SHOP_CATEGORY_SEARCHABLE_FIELDS)[number];

/* ─── Table configs ─────────────────────────────────────────────────────────── */

export interface AdminTableSortableFieldConfig {
  field: string;
  /** Human-readable label for UI dropdowns */
  label: string;
  /** Data type for range/search handling */
  dataType: "string" | "number" | "boolean" | "date";
}

export interface AdminTableSearchableFieldConfig {
  field: string;
  label: string;
  dataType: "string" | "number" | "date";
}

export interface AdminTableFilterConfig {
  param: string;
  label: string;
  type: "select" | "boolean" | "date-range" | "combobox";
  options?: { value: string; label: string }[];
}

export interface AdminTableGroupByOption {
  value: string;
  label: string;
}

export interface AdminTableConfig<TSortable extends string = string> {
  /** Fields that can be used in ?sortField= */
  sortableFields: readonly string[];
  /** Fields that can be used in ?search[field]= */
  searchableFields: readonly string[];
  /** Default sort */
  defaultSort: { field: TSortable; dir: "asc" | "desc" };
  /** Group-by options */
  groupByOptions: AdminTableGroupByOption[];
}

export const ADMIN_USER_TABLE: AdminTableConfig<AdminUserSortableField> = {
  sortableFields: ADMIN_USER_SORTABLE_FIELDS,
  searchableFields: ADMIN_USER_SEARCHABLE_FIELDS,
  defaultSort: { field: "createdAt", dir: "desc" },
  groupByOptions: [
    { value: "role", label: "Role" },
    { value: "verification", label: "Verification" },
  ],
};

export const ADMIN_ORDER_TABLE: AdminTableConfig<AdminOrderSortableField> = {
  sortableFields: ADMIN_ORDER_SORTABLE_FIELDS,
  searchableFields: ADMIN_ORDER_SEARCHABLE_FIELDS,
  defaultSort: { field: "createdAt", dir: "desc" },
  groupByOptions: [
    { value: "user", label: "User" },
    { value: "status", label: "Status" },
  ],
};

export const ADMIN_COMPETITION_TABLE: AdminTableConfig<AdminCompetitionSortableField> = {
  sortableFields: ADMIN_COMPETITION_SORTABLE_FIELDS,
  searchableFields: ADMIN_COMPETITION_SEARCHABLE_FIELDS,
  defaultSort: { field: "createdAt", dir: "desc" },
  groupByOptions: [
    { value: "status", label: "Status" },
    { value: "category", label: "Category" },
  ],
};

export const ADMIN_CATEGORY_TABLE: AdminTableConfig<AdminCategorySortableField> = {
  sortableFields: ADMIN_CATEGORY_SORTABLE_FIELDS,
  searchableFields: ADMIN_CATEGORY_SEARCHABLE_FIELDS,
  defaultSort: { field: "displayOrder", dir: "asc" },
  groupByOptions: [{ value: "name", label: "Name" }],
};

export const ADMIN_PROMO_CODE_TABLE: AdminTableConfig<AdminPromoCodeSortableField> = {
  sortableFields: ADMIN_PROMO_CODE_SORTABLE_FIELDS,
  searchableFields: ADMIN_PROMO_CODE_SEARCHABLE_FIELDS,
  defaultSort: { field: "createdAt", dir: "desc" },
  groupByOptions: [
    { value: "discountType", label: "Discount Type" },
    { value: "status", label: "Status" },
  ],
};

export const ADMIN_INSTANT_PRIZE_TABLE: AdminTableConfig<AdminInstantPrizeSortableField> = {
  sortableFields: ADMIN_INSTANT_PRIZE_SORTABLE_FIELDS,
  searchableFields: ADMIN_INSTANT_PRIZE_SEARCHABLE_FIELDS,
  defaultSort: { field: "createdAt", dir: "desc" },
  groupByOptions: [{ value: "type", label: "Type" }],
};

export const ADMIN_WINNER_TABLE: AdminTableConfig<AdminWinnerSortableField> = {
  sortableFields: ADMIN_WINNER_SORTABLE_FIELDS,
  searchableFields: ADMIN_WINNER_SEARCHABLE_FIELDS,
  defaultSort: { field: "drawnAt", dir: "desc" },
  groupByOptions: [
    { value: "user", label: "User" },
    { value: "prize", label: "Prize" },
    { value: "competition", label: "Competition" },
  ],
};

export const ADMIN_BALANCE_TABLE: AdminTableConfig<AdminBalanceSortableField> = {
  sortableFields: ADMIN_BALANCE_SORTABLE_FIELDS,
  searchableFields: ADMIN_BALANCE_SEARCHABLE_FIELDS,
  defaultSort: { field: "createdAt", dir: "desc" },
  groupByOptions: [],
};

export const ADMIN_REFERRAL_TABLE: AdminTableConfig<AdminReferralSortableField> = {
  sortableFields: ADMIN_REFERRAL_SORTABLE_FIELDS,
  searchableFields: ADMIN_REFERRAL_SEARCHABLE_FIELDS,
  defaultSort: { field: "createdAt", dir: "desc" },
  groupByOptions: [
    { value: "referrer", label: "Referrer" },
    { value: "status", label: "Status" },
  ],
};

export const ADMIN_REFERRAL_PURCHASE_TABLE: AdminTableConfig<AdminReferralPurchaseSortableField> = {
  sortableFields: ADMIN_REFERRAL_PURCHASE_SORTABLE_FIELDS,
  searchableFields: ADMIN_REFERRAL_PURCHASE_SEARCHABLE_FIELDS,
  defaultSort: { field: "createdAt", dir: "desc" },
  groupByOptions: [
    { value: "referrer", label: "Referrer" },
    { value: "status", label: "Status" },
  ],
};

export const ADMIN_INSTANT_PRIZE_WIN_TABLE: AdminTableConfig<AdminInstantPrizeWinSortableField> = {
  sortableFields: ADMIN_INSTANT_PRIZE_WIN_SORTABLE_FIELDS,
  searchableFields: ADMIN_INSTANT_PRIZE_WIN_SEARCHABLE_FIELDS,
  defaultSort: { field: "wonAt", dir: "desc" },
  groupByOptions: [
    { value: "user", label: "User" },
    { value: "prize", label: "Prize" },
  ],
};

export const ADMIN_COMPETITION_INSTANT_PRIZE_TABLE: AdminTableConfig<AdminCompetitionInstantPrizeSortableField> =
  {
    sortableFields: ADMIN_COMPETITION_INSTANT_PRIZE_SORTABLE_FIELDS,
    searchableFields: ["prizeTitle", "competitionTitle"],
    defaultSort: { field: "createdAt", dir: "desc" },
    groupByOptions: [
      { value: "competition", label: "Competition" },
      { value: "prize", label: "Prize" },
    ],
  };

export const ADMIN_SHOP_CATEGORY_TABLE: AdminTableConfig<AdminShopCategorySortableField> = {
  sortableFields: ADMIN_SHOP_CATEGORY_SORTABLE_FIELDS,
  searchableFields: ADMIN_SHOP_CATEGORY_SEARCHABLE_FIELDS,
  defaultSort: { field: "sortOrder", dir: "asc" },
  groupByOptions: [],
};

export const ADMIN_BONUS_AWARD_SORTABLE_FIELDS = [
  "title",
  "value",
  "isActive",
  "type",
  "createdAt",
  "totalAssignments",
] as const;
export type AdminBonusAwardSortableField = (typeof ADMIN_BONUS_AWARD_SORTABLE_FIELDS)[number];

export const ADMIN_BONUS_AWARD_TABLE: AdminTableConfig<AdminBonusAwardSortableField> = {
  sortableFields: ADMIN_BONUS_AWARD_SORTABLE_FIELDS,
  searchableFields: ["title", "description", "type"],
  defaultSort: { field: "createdAt", dir: "desc" },
  groupByOptions: [{ value: "type", label: "Type" }],
};

export const ADMIN_BONUS_AWARD_ASSIGNMENT_SORTABLE_FIELDS = [
  "milestonePct",
  "quantity",
  "wonCount",
  "createdAt",
] as const;
export type AdminBonusAwardAssignmentSortableField =
  (typeof ADMIN_BONUS_AWARD_ASSIGNMENT_SORTABLE_FIELDS)[number];

export const ADMIN_BONUS_AWARD_ASSIGNMENT_TABLE: AdminTableConfig<AdminBonusAwardAssignmentSortableField> =
  {
    sortableFields: ADMIN_BONUS_AWARD_ASSIGNMENT_SORTABLE_FIELDS,
    searchableFields: ["bonusAwardTitle", "competitionTitle"],
    defaultSort: { field: "milestonePct", dir: "asc" },
    groupByOptions: [
      { value: "competition", label: "Competition" },
      { value: "firedStatus", label: "Status" },
    ],
  };

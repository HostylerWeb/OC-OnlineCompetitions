export const queryKeys = {
  competitions: {
    all: (params?: Record<string, unknown>) => ["competitions", params] as const,
    featured: () => ["competitions", "featured"] as const,
    detail: (slug: string) => ["competitions", slug] as const,
    availability: (id: string) => ["competitions", id, "availability"] as const,
    availabilityBatch: (idsKey: string) => ["competitions", "availability-batch", idsKey] as const,
    buyingPower: (id: string) => ["competitions", id, "buying-power"] as const,
    buyingPowerBatch: (idsKey: string) => ["competitions", "buying-power-batch", idsKey] as const,
    instantPrizes: (id: string, mode?: "all" | "infinite") =>
      mode === "infinite"
        ? (["competitions", id, "instant-prizes", "infinite"] as const)
        : (["competitions", id, "instant-prizes"] as const),
  },
  categories: () => ["categories"] as const,
  competitionCategories: () => ["competition-categories"] as const,
  winners: {
    recent: (limit?: number) => ["winners", "recent", limit] as const,
    stats: () => ["winners", "stats"] as const,
  },
  faq: {
    all: (category?: string) => ["faq", category ?? "general"] as const,
    categories: () => ["faq", "categories"] as const,
  },
  content: {
    steps: () => ["content", "steps"] as const,
    features: () => ["content", "features"] as const,
  },
  payment: {
    config: () => ["payment", "config"] as const,
    providers: () => ["payment", "providers"] as const,
    session: (provider: string, id: string) => ["payment", "session", provider, id] as const,
  },
  public: {
    endingSoonSettings: () => ["public", "ending-soon-settings"] as const,
    homepageLayoutSettings: () => ["public", "homepage-layout-settings"] as const,
    referralSettings: () => ["public", "referral-settings"] as const,
    complianceSettings: () => ["public", "compliance-settings"] as const,
  },
  dashboard: {
    all: () => ["dashboard"] as const,
  },
  my: {
    profile: () => ["my", "profile"] as const,
    stats: () => ["my", "stats"] as const,
    ordersBase: () => ["my", "orders"] as const,
    orders: (page = 1) => ["my", "orders", page] as const,
    entriesBase: () => ["my", "entries"] as const,
    entriesStats: () => ["my", "entries", "stats"] as const,
    entries: (page = 1, limit = 100) => ["my", "entries", page, limit] as const,
    entriesInfinite: (limit = 100) => ["my", "entries", "infinite", limit] as const,
    wins: () => ["my", "wins"] as const,
    winsInfinite: (limit = 20) => ["my", "wins", "infinite", limit] as const,
    referrals: () => ["my", "referrals"] as const,
    referralTickets: () => ["my", "referral-tickets"] as const,
    balance: () => ["my", "balance"] as const,
    balanceTransactions: (page = 1) => ["my", "balance", "transactions", page] as const,
    instantPrizeWins: () => ["my", "instant-prize-wins"] as const,
    instantPrizeWinsByIds: (idsKey: string) =>
      ["my", "instant-prize-wins", "by-ids", idsKey] as const,
    instantPrizeWinsInfinite: (limit = 20) =>
      ["my", "instant-prize-wins", "infinite", limit] as const,
    bonusAwardWinsInfinite: (limit = 20) => ["my", "bonus-award-wins", "infinite", limit] as const,
    pendingOrder: () => ["my", "pending-order"] as const,
    saferPlay: () => ["my", "safer-play"] as const,
    personalisation: (surface: string) => ["my", "personalisation", surface] as const,
  },
  admin: {
    dashboard: () => ["admin", "dashboard"] as const,
    competition: (id: string) => ["admin", "competitions", id] as const,
    competitions: (status?: string, categoryId?: string, page = 1, limit = 20) =>
      ["admin", "competitions", status ?? "", categoryId ?? "", page, limit] as const,
    frameExtractionStatus: (competitionId: string) =>
      ["admin", "frame-extraction", competitionId] as const,
    orders: (page = 1, statusFilter = "", userId = "", limit = 20) =>
      ["admin", "orders", page, statusFilter, userId, limit] as const,
    users: (verified?: string, isAdmin?: string, page = 1, limit = 20) =>
      ["admin", "users", verified ?? "", isAdmin ?? "", page, limit] as const,
    user: (userId: string) => ["admin", "user", userId] as const,
    userCompliance: (userId: string) => ["admin", "user-compliance", userId] as const,
    userComplianceAudit: (userId: string, limit = 50) =>
      ["admin", "user-compliance-audit", userId, limit] as const,
    userReferralStats: (userId: string) => ["admin", "user-referral-stats", userId] as const,
    userBalance: (userId: string) => ["admin", "user-balance", userId] as const,
    categories: (page = 1, limit = 20, search = "") =>
      ["admin", "categories", page, limit, search] as const,
    promoCodes: (page = 1, limit = 20) => ["admin", "promo-codes", page, limit] as const,
    instantPrizeTemplates: (page = 1, limit = 20, search = "", isActive = "") =>
      ["admin", "instant-prizes", "templates", page, limit, search, isActive] as const,
    competitionInstantPrizeAssignments: (competitionId: string) =>
      ["admin", "competition-instant-prizes", "assignments", competitionId] as const,
    instantPrizeCapacityBase: (competitionId: string) =>
      ["admin", "competition-instant-prizes", "capacity", competitionId] as const,
    instantPrizeCapacity: (
      competitionId: string,
      params?: Record<string, string | number | undefined>
    ) => [...queryKeys.admin.instantPrizeCapacityBase(competitionId), params ?? {}] as const,
    winners: (claimed?: string, competitionId?: string, userId?: string, page = 1, limit = 20) =>
      ["admin", "winners", claimed ?? "", competitionId ?? "", userId ?? "", page, limit] as const,
    instantPrizeWins: (
      claimed?: string,
      competitionId?: string,
      userId?: string,
      page = 1,
      limit = 20,
      startDate?: string,
      endDate?: string
    ) =>
      [
        "admin",
        "instant-prize-wins",
        claimed ?? "",
        competitionId ?? "",
        userId ?? "",
        page,
        limit,
        startDate ?? "",
        endDate ?? "",
      ] as const,
    referralPurchases: (status = "all", referrerId = "", page = 1, limit = 20) =>
      ["admin", "referral-purchases", status, referrerId, page, limit] as const,
    referrals: (status = "all", page = 1, limit = 20) =>
      ["admin", "referrals", status, page, limit] as const,
    referralSettings: () => ["admin", "referral-settings"] as const,
    complianceSettings: () => ["admin", "compliance-settings"] as const,
    endingSoonSettings: () => ["admin", "ending-soon-settings"] as const,
    homepageLayoutSettings: () => ["admin", "homepage-layout-settings"] as const,
    paymentMethods: () => ["admin", "payment-methods"] as const,
    testimonials: (statusFilter = "", page = 1, limit = 20) =>
      ["admin", "testimonials", statusFilter ?? "", page, limit] as const,
    faqs: (page = 1, limit = 20) => ["admin", "faqs", page, limit] as const,
    features: (page = 1, limit = 20) => ["admin", "features", page, limit] as const,
    howItWorks: (page = 1, limit = 20) => ["admin", "how-it-works", page, limit] as const,
    emailSettings: () => ["admin", "email-settings"] as const,
    notifications: (page = 1, type = "", status = "") =>
      ["admin", "notifications", page, type, status] as const,
    notification: (id: string) => ["admin", "notifications", id] as const,
    notificationStats: () => ["admin", "notifications", "stats"] as const,
    pushSubscriptions: (page = 1, search = "") =>
      ["admin", "notifications", "subscriptions", page, search] as const,
    search: (q: string) => ["admin", "search", q] as const,
    selfExcludedUsers: () => ["admin", "self-excluded-users"] as const,
    debug: () => ["admin", "debug"] as const,
  },
  entries: {
    competitions: () => ["entries", "competitions"] as const,
    infinite: (competitionId: string, limit = 50, search?: string) =>
      ["entries", competitionId, "infinite", limit, search ?? ""] as const,
  },
  cart: () => ["cart"] as const,
};

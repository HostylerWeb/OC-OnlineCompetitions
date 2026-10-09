import { DEFAULT_COMPLIANCE_SETTINGS } from "@oc/api-db/models/ComplianceSettings";
import bcrypt from "bcryptjs";
import mongoose, { type Mongoose, Types } from "mongoose";

const ADMIN_EMAIL = "admin@onlinecompetitions.co.uk";
const ADMIN_PASSWORD = "Tct#LYG5bzdvgadySB#gGjBV";
const MANAGER_EMAIL = "manager@onlinecompetitions.co.uk";
const MANAGER_PASSWORD = "Tct#LYG5bzdvgadySB#gGjBV";

export interface SeedData {
  adminUserId: string;
  adminOid: Types.ObjectId;
  categoryIds: Types.ObjectId[];
  competitionIds: Types.ObjectId[];
  userIds: Types.ObjectId[];
  orderIds: Types.ObjectId[];
  promoCodeIds: Types.ObjectId[];
  winnerIds: Types.ObjectId[];
  instantPrizeIds: Types.ObjectId[];
}

async function clearCollections(db: ReturnType<Mongoose["connection"]["db"]>) {
  const collections = [
    "profiles",
    "competitions",
    "categories",
    "orders",
    "orderitems",
    "tickets",
    "promocodes",
    "winners",
    "instantprizes",
    "instantprizewins",
    "balances",
    "user",
    "account",
    "session",
    "referralpurchases",
    "referralsettings",
    "carts",
    "homepagelayoutsettings",
    "emailsettings",
    "compliancesettings",
    "complianceauditlogs",
    "paymentmethods",
    "competitioninstantprizes",
    "frameextractionjobs",
  ];
  for (const col of collections) {
    try {
      await db.collection(col).deleteMany({});
    } catch {
      // collection may not exist
    }
  }
}

export async function seedDatabase(): Promise<SeedData> {
  const DATABASE_URL =
    process.env.DATABASE_URL ||
    "mongodb://root:onlinecompetitions_dev_password@localhost:27017/onlinecompetitions?directConnection=true";

  await mongoose.connect(DATABASE_URL);
  const db = mongoose.connection.db!;

  await clearCollections(db);

  await db.collection("compliancesettings").insertOne(DEFAULT_COMPLIANCE_SETTINGS);

  const now = new Date();
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  // ── Admin User ──────────────────────────────────────────────────────────
  const adminOid = new Types.ObjectId();
  const adminIdHex = adminOid.toHexString();

  await db.collection("user").insertOne({
    _id: adminIdHex,
    email: ADMIN_EMAIL,
    emailVerified: true,
    name: "Admin User",
    role: "admin",
    firstName: "Admin",
    lastName: "User",
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("account").insertOne({
    userId: adminIdHex,
    providerId: "credential",
    providerAccountId: adminIdHex,
    password: passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  const referralCode = "ADMIN01";

  await db.collection("profiles").insertOne({
    _id: adminOid,
    email: ADMIN_EMAIL,
    firstName: "Admin",
    lastName: "User",
    country: "GB",
    role: "admin",
    isAdmin: true,
    isVerified: true,
    referralCode,
    totalEntries: 0,
    totalSpent: 0,
    winsCount: 0,
    referralCount: 0,
    referralMultiplier: 1,
    referralTierAwardedTickets: 0,
    subscriptionStatus: "none",
    subscriptionTier: null,
    marketingConsent: false,
    showLastName: true,
    showLocation: true,
    showSocials: true,
    createdAt: now,
    updatedAt: now,
  });

  // ── Manager User ────────────────────────────────────────────────────────
  const managerOid = new Types.ObjectId();
  const managerIdHex = managerOid.toHexString();

  await db.collection("user").insertOne({
    _id: managerIdHex,
    email: MANAGER_EMAIL,
    emailVerified: true,
    name: "Manager User",
    role: "manager",
    firstName: "Manager",
    lastName: "User",
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("account").insertOne({
    userId: managerIdHex,
    providerId: "credential",
    providerAccountId: managerIdHex,
    password: passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("profiles").insertOne({
    _id: managerOid,
    email: MANAGER_EMAIL,
    firstName: "Manager",
    lastName: "User",
    country: "GB",
    role: "manager",
    isAdmin: true,
    isVerified: true,
    referralCode: "MANAGER01",
    totalEntries: 0,
    totalSpent: 0,
    winsCount: 0,
    referralCount: 0,
    referralMultiplier: 1,
    referralTierAwardedTickets: 0,
    subscriptionStatus: "none",
    subscriptionTier: null,
    marketingConsent: false,
    showLastName: true,
    showLocation: true,
    showSocials: true,
    createdAt: now,
    updatedAt: now,
  });

  // ── Categories ──────────────────────────────────────────────────────────
  const categories = [
    { slug: "cash", name: "Cash", label: "Cash", iconName: "PoundSterling", displayOrder: 0 },
    { slug: "cars", name: "Cars", label: "Cars & Vehicles", iconName: "Car", displayOrder: 1 },
    {
      slug: "tech-lifestyle",
      name: "Tech & Lifestyle",
      label: "Tech & Lifestyle",
      iconName: "Laptop",
      displayOrder: 2,
    },
  ];
  const categoryIds = categories.map((_c) => new Types.ObjectId());
  for (let i = 0; i < categories.length; i++) {
    await db.collection("categories").insertOne({
      _id: categoryIds[i],
      slug: categories[i].slug,
      name: categories[i].name,
      label: categories[i].label,
      iconName: categories[i].iconName,
      isActive: true,
      displayOrder: categories[i].displayOrder,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deletedBy: null,
    });
  }

  // ── Competitions ────────────────────────────────────────────────────────
  const competitions = [
    {
      slug: "win-5000-cash",
      title: "Win £5,000 Cash",
      category: "cash",
      status: "active",
      prizeValue: 5000,
      ticketPrice: 5,
      maxTickets: 2000,
      isFeatured: true,
    },
    {
      slug: "luxury-suv",
      title: "Luxury SUV Giveaway",
      category: "cars",
      status: "draft",
      prizeValue: 50000,
      ticketPrice: 10,
      maxTickets: 5000,
      isFeatured: false,
    },
    {
      slug: "macbook-pro",
      title: "MacBook Pro Bundle",
      category: "tech-lifestyle",
      status: "ended",
      prizeValue: 2000,
      ticketPrice: 2,
      maxTickets: 1000,
      isFeatured: false,
    },
    {
      slug: "10000-cash-pending",
      title: "£10,000 Cash Prize",
      category: "cash",
      status: "pending_draw",
      prizeValue: 10000,
      ticketPrice: 8,
      maxTickets: 3000,
      isFeatured: true,
    },
    {
      slug: "ps5-bundle",
      title: "PS5 Gaming Bundle",
      category: "tech-lifestyle",
      status: "active",
      prizeValue: 1500,
      ticketPrice: 3,
      maxTickets: 500,
      isFeatured: false,
    },
  ];
  const competitionIds = competitions.map(() => new Types.ObjectId());
  for (let i = 0; i < competitions.length; i++) {
    const c = competitions[i];
    const startDate = new Date(now);
    if (c.status === "ended" || c.status === "pending_draw") {
      startDate.setDate(startDate.getDate() - 30);
    } else if (c.status === "draft") {
      startDate.setDate(startDate.getDate() + 7);
    } else {
      startDate.setDate(startDate.getDate() - 7);
    }
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 21);
    const drawDate = new Date(endDate);
    drawDate.setDate(drawDate.getDate() + 1);

    await db.collection("competitions").insertOne({
      _id: competitionIds[i],
      slug: c.slug,
      title: c.title,
      shortDescription: `Win this amazing ${c.category} prize!`,
      category: c.category,
      status: c.status,
      prizeValue: c.prizeValue,
      prizeImageUrl: null,
      ticketPrice: c.ticketPrice,
      maxTickets: c.maxTickets,
      maxTicketsPerUser: 100,
      currency: "GBP",
      isFeatured: c.isFeatured,
      displayOrder: i,
      isHeroFeatured: false,
      startDate,
      endDate,
      drawDate,
      isReferralReward: false,
      createdBy: adminOid,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deletedBy: null,
    });
  }

  // ── Test Users ──────────────────────────────────────────────────────────
  const userEmails = [
    "alice@test.com",
    "bob@test.com",
    "charlie@test.com",
    "diana@test.com",
    "eve@test.com",
    "frank@test.com",
    "grace@test.com",
    "henry@test.com",
    "iris@test.com",
    "jack@test.com",
  ];
  const userIds = userEmails.map(() => new Types.ObjectId());
  const userPasswordHash = await bcrypt.hash("TestPass123!", 10);

  for (let i = 0; i < userEmails.length; i++) {
    const uid = userIds[i];
    const uidHex = uid.toHexString();

    await db.collection("user").insertOne({
      _id: uidHex,
      email: userEmails[i],
      emailVerified: i < 7,
      name: `User ${i + 1}`,
      role: "user",
      firstName: userEmails[i].split("@")[0],
      lastName: `Test${i + 1}`,
      createdAt: now,
      updatedAt: now,
    });

    await db.collection("account").insertOne({
      userId: uidHex,
      providerId: "credential",
      providerAccountId: uidHex,
      password: userPasswordHash,
      createdAt: now,
      updatedAt: now,
    });

    const userRefCode = `USER${String(i + 1).padStart(2, "0")}`;

    await db.collection("profiles").insertOne({
      _id: uid,
      email: userEmails[i],
      firstName: userEmails[i].split("@")[0],
      lastName: `Test${i + 1}`,
      country: "GB",
      isAdmin: false,
      isVerified: i < 7,
      ageVerifiedAt: i < 5 ? now : undefined,
      isAgeVerified: i < 5,
      referralCode: userRefCode,
      totalEntries: (i + 1) * 5,
      totalSpent: (i + 1) * 25,
      winsCount: i < 3 ? 1 : 0,
      referralCount: i === 0 ? 2 : 0,
      referralMultiplier: 1,
      referralTierAwardedTickets: 0,
      subscriptionStatus: "none" as const,
      subscriptionTier: null,
      marketingConsent: i % 2 === 0,
      showLastName: true,
      showLocation: true,
      showSocials: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.collection("balances").insertOne({
      _id: new Types.ObjectId(),
      userId: uid,
      available: i * 10,
      pending: 0,
      currency: "GBP",
      createdAt: now,
      updatedAt: now,
    });
  }

  // ── Orders ──────────────────────────────────────────────────────────────
  const orderStatuses: Array<"completed" | "pending" | "processing" | "failed" | "refunded"> = [
    "completed",
    "completed",
    "completed",
    "pending",
    "processing",
    "completed",
    "failed",
    "completed",
    "refunded",
    "completed",
    "pending",
    "completed",
    "completed",
    "processing",
    "completed",
    "refunded",
    "completed",
    "pending",
    "completed",
    "completed",
  ];
  const orderIds = orderStatuses.map(() => new Types.ObjectId());

  for (let i = 0; i < orderStatuses.length; i++) {
    const userId = userIds[i % userIds.length];
    const compId = competitionIds[i % competitionIds.length];
    const ticketPrice = competitions[i % competitions.length].ticketPrice;
    const qty = Math.floor(Math.random() * 5) + 1;
    const subtotal = ticketPrice * qty;
    const total = subtotal;
    const paidAt =
      orderStatuses[i] === "completed" ? new Date(now.getTime() - i * 3600000) : undefined;

    await db.collection("orders").insertOne({
      _id: orderIds[i],
      orderNumber: 1001 + i,
      userId,
      status: orderStatuses[i],
      subtotal,
      discountAmount: 0,
      total,
      provider: "local" as const,
      paidAt,
      idempotencyKey: `e2e-${i}`,
      metadata: {},
      createdAt: new Date(now.getTime() - (i + 1) * 3600000),
      updatedAt: now,
      deletedAt: null,
      deletedBy: null,
    });

    await db.collection("orderitems").insertOne({
      _id: new Types.ObjectId(),
      orderId: orderIds[i],
      competitionId: compId,
      quantity: qty,
      unitPrice: ticketPrice,
      totalPrice: total,
      ticketNumbers: Array.from({ length: qty }, (_, j) => i * 10 + j + 1),
      createdAt: now,
      deletedAt: null,
      deletedBy: null,
    });
  }

  // ── Referral Purchases (test fixture) ─────────────────────────────────
  // User 0 (USER01) is the top referrer in the leaderboard.
  // Profile.referralCount is INTENTIONALLY set higher than the live count
  // to verify the leaderboard counts UNIQUE active referees, not the cached
  // counter. Run scripts/recompute-referral-counts.ts to reconcile.
  const referralPurchasesToInsert = [
    { referrerIdx: 0, refereeIdx: 1, orderIdx: 0, deleted: false },
    { referrerIdx: 0, refereeIdx: 2, orderIdx: 1, deleted: false },
    { referrerIdx: 0, refereeIdx: 3, orderIdx: 2, deleted: false },
    { referrerIdx: 1, refereeIdx: 4, orderIdx: 3, deleted: false },
    { referrerIdx: 1, refereeIdx: 5, orderIdx: 4, deleted: false },
    { referrerIdx: 0, refereeIdx: 6, orderIdx: 5, deleted: true },
  ];
  for (const rp of referralPurchasesToInsert) {
    const referrer = userIds[rp.referrerIdx];
    const referee = userIds[rp.refereeIdx];
    await db.collection("referralpurchases").insertOne({
      _id: new Types.ObjectId(),
      referrerId: referrer,
      referredUserId: referee,
      orderId: orderIds[rp.orderIdx],
      purchaseAmount: 25,
      purchasedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      referrerEmail: userEmails[rp.referrerIdx],
      referredEmail: userEmails[rp.refereeIdx],
      signupReferrerId: referrer,
      commissionAmount: 0,
      ticketsAwarded: 0,
      deletedAt: rp.deleted ? new Date() : null,
      deletedBy: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  // ── Promo Codes ────────────────────────────────────────────────────────
  const promoCodes = [
    {
      code: "WELCOME10",
      type: "percentage" as const,
      value: 10,
      minOrder: 10,
      maxUses: 100,
      active: true,
    },
    {
      code: "SAVE20",
      type: "percentage" as const,
      value: 20,
      minOrder: 25,
      maxUses: 50,
      active: true,
    },
    { code: "FLAT5", type: "fixed" as const, value: 5, minOrder: 0, maxUses: 200, active: true },
    {
      code: "EXPIRED50",
      type: "percentage" as const,
      value: 50,
      minOrder: 50,
      maxUses: 10,
      active: false,
    },
    { code: "VIP100", type: "fixed" as const, value: 100, minOrder: 200, maxUses: 5, active: true },
  ];
  const promoCodeIds = promoCodes.map(() => new Types.ObjectId());

  for (let i = 0; i < promoCodes.length; i++) {
    const p = promoCodes[i];
    const validFrom = new Date(now);
    validFrom.setDate(validFrom.getDate() - 30);
    const validUntil = new Date(now);
    validUntil.setDate(validUntil.getDate() + (p.active ? 30 : -30));

    await db.collection("promocodes").insertOne({
      _id: promoCodeIds[i],
      code: p.code,
      discountType: p.type,
      discountValue: p.value,
      minOrderValue: p.minOrder,
      maxUses: p.maxUses,
      currentUses: i * 2,
      maxUsesPerUser: 1,
      usedBy: [],
      validFrom,
      validUntil,
      isActive: p.active,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deletedBy: null,
    });
  }

  // ── Winners ─────────────────────────────────────────────────────────────
  const winnerIds = new Array(5).fill(null).map(() => new Types.ObjectId());
  for (let i = 0; i < 5; i++) {
    const userId = userIds[i];
    const compId = competitionIds[i % competitionIds.length];
    const prizeValue = competitions[i % competitions.length].prizeValue;

    await db.collection("winners").insertOne({
      _id: winnerIds[i],
      competitionId: compId,
      userId,
      ticketNumber: (i + 1) * 42,
      prizeTitle: competitions[i % competitions.length].title,
      prizeValue,
      prizeImageUrl: null,
      displayName: userEmails[i].split("@")[0],
      location: "London, UK",
      showFullName: false,
      claimed: i < 3,
      claimedAt: i < 3 ? now : undefined,
      drawnAt: new Date(now.getTime() - i * 86400000),
      createdAt: new Date(now.getTime() - i * 86400000),
      updatedAt: now,
      deletedAt: null,
      deletedBy: null,
    });
  }

  // ── Instant Prizes ─────────────────────────────────────────────────────
  const instantPrizeIds = new Array(3).fill(null).map(() => new Types.ObjectId());

  await db.collection("instantprizes").insertOne({
    _id: instantPrizeIds[0],
    title: "Free Ticket Bonus",
    description: "Win a free entry ticket",
    value: 5,
    images: [],
    isActive: true,
    type: "competition_ticket",
    ticketCount: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
  });

  await db.collection("instantprizes").insertOne({
    _id: instantPrizeIds[1],
    title: "£50 Cash Bonus",
    description: "Instant £50 cash prize",
    value: 50,
    images: [],
    isActive: true,
    type: "prize",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
  });

  await db.collection("instantprizes").insertOne({
    _id: instantPrizeIds[2],
    title: "Expired Bonus",
    description: "No longer available",
    value: 10,
    images: [],
    isActive: false,
    type: "prize",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
  });

  // ── Instant Prize Wins ─────────────────────────────────────────────────
  const ipwUserId = userIds[0];
  const _ipwCompId = competitionIds[0];

  await db.collection("instantprizewins").insertOne({
    _id: new Types.ObjectId(),
    competitionInstantPrizeId: instantPrizeIds[0],
    userId: ipwUserId,
    entryId: new Types.ObjectId(),
    ticketNumber: 100,
    claimed: false,
    wonAt: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
  });

  await db.collection("instantprizewins").insertOne({
    _id: new Types.ObjectId(),
    competitionInstantPrizeId: instantPrizeIds[1],
    userId: ipwUserId,
    entryId: new Types.ObjectId(),
    ticketNumber: 200,
    claimed: true,
    claimedAt: now,
    shippingAddress: {
      addressLine1: "123 Test Street",
      city: "London",
      postcode: "SW1A 1AA",
      country: "GB",
    },
    wonAt: new Date(now.getTime() - 86400000),
    createdAt: new Date(now.getTime() - 86400000),
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
  });

  await db.collection("instantprizewins").insertOne({
    _id: new Types.ObjectId(),
    competitionInstantPrizeId: instantPrizeIds[0],
    userId: userIds[1],
    entryId: new Types.ObjectId(),
    ticketNumber: 300,
    claimed: false,
    wonAt: new Date(now.getTime() - 2 * 86400000),
    createdAt: new Date(now.getTime() - 2 * 86400000),
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
  });

  await mongoose.disconnect();

  return {
    adminUserId: adminIdHex,
    adminOid,
    categoryIds,
    competitionIds,
    userIds,
    orderIds,
    promoCodeIds,
    winnerIds,
    instantPrizeIds,
  };
}

async function main() {
  console.log("Seeding database...");
  const data = await seedDatabase();
  console.log(
    `Seeded: 1 admin, ${data.userIds.length} users, ${data.competitionIds.length} competitions, ${data.categoryIds.length} categories, ${data.orderIds.length} orders, ${data.promoCodeIds.length} promo codes, ${data.winnerIds.length} winners, ${data.instantPrizeIds.length} instant prizes`
  );
  process.exit(0);
}

if (require.main === module || import.meta.url === `file://${process.argv[1]}`) {
  main();
}

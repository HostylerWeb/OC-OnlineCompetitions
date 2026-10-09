import { describe, expect, it } from "vitest";
import { ReferralTicketsAllocatedEmail } from "./referral-tickets-allocated";

describe("ReferralTicketsAllocatedEmail", () => {
  it("renders with allocations", () => {
    const result = ReferralTicketsAllocatedEmail({
      userName: "John",
      totalTickets: 6,
      competitionCount: 3,
      allocation: [
        { competitionId: "c1", competitionTitle: "Comp A", ticketNumbers: [101, 102], qty: 2 },
        { competitionId: "c2", competitionTitle: "Comp B", ticketNumbers: [203], qty: 1 },
        { competitionId: "c3", competitionTitle: "Comp C", ticketNumbers: [304, 305, 306], qty: 3 },
      ],
      currentTier: "Silver",
      frontendUrl: "https://onlinecompetitions.co.uk",
    });
    expect(result).toBeTruthy();
  });

  it("handles singular labels when totalTickets is 1", () => {
    const result = ReferralTicketsAllocatedEmail({
      userName: "Ada",
      totalTickets: 1,
      competitionCount: 1,
      allocation: [
        { competitionId: "solo", competitionTitle: "Solo Comp", ticketNumbers: [42], qty: 1 },
      ],
      frontendUrl: "https://onlinecompetitions.co.uk",
    });
    expect(result).toBeTruthy();
  });

  it("renders without allocations", () => {
    const result = ReferralTicketsAllocatedEmail({
      userName: "Sam",
      totalTickets: 0,
      competitionCount: 0,
      allocation: [],
      frontendUrl: "https://onlinecompetitions.co.uk",
    });
    expect(result).toBeTruthy();
  });
});

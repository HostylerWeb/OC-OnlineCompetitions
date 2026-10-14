export type MilestonePrizeCategory = "cash" | "site_credit" | "physical";

export type MilestonePrizeSetup = MilestonePrizeCategory | "competition_ticket";

export function milestonePrizeSetupToFields(setup: MilestonePrizeSetup): {
  type: "prize" | "competition_ticket";
  prizeCategory?: MilestonePrizeCategory;
} {
  if (setup === "competition_ticket") {
    return { type: "competition_ticket" };
  }
  return { type: "prize", prizeCategory: setup };
}

export function milestonePrizeFieldsToSetup(
  type: "prize" | "competition_ticket",
  prizeCategory?: MilestonePrizeCategory | null
): MilestonePrizeSetup {
  if (type === "competition_ticket") return "competition_ticket";
  if (prizeCategory === "cash" || prizeCategory === "site_credit" || prizeCategory === "physical") {
    return prizeCategory;
  }
  return "physical";
}

export function milestonePrizeSetupLabel(setup: MilestonePrizeSetup): string {
  switch (setup) {
    case "cash":
      return "Cash";
    case "site_credit":
      return "Site credit";
    case "physical":
      return "Physical prize";
    case "competition_ticket":
      return "Tickets";
    default:
      return setup;
  }
}

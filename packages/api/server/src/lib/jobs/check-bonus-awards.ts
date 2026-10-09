import { BonusAwardFire, Competition } from "@oc/api-db/models";
import { createLogger } from "@oc/api-logger";
import {
  checkBonusAwardMilestones,
  pickPendingBonusAwardWinners,
} from "@oc/api-tickets/bonus-award-draw";
import { notifyBonusAwardWins } from "../payment/notify-bonus-award-wins";

const logger = createLogger("jobs:check-bonus-awards");

export async function runCheckBonusAwardMilestones(): Promise<{
  triggered: number;
  drawn: number;
}> {
  const competitions = await Competition.find(
    { status: "active", deletedAt: null },
    { _id: 1, ticketsSold: 1, title: 1 }
  ).lean();

  console.log(
    "[bonus-award] runCheckBonusAwardMilestones: checking %d competitions",
    competitions.length
  );

  let triggered = 0;
  let drawn = 0;

  for (const comp of competitions) {
    try {
      console.log(
        "[bonus-award] runCheckBonusAwardMilestones: comp=%s ticketsSold=%d",
        comp.title,
        comp.ticketsSold
      );
      const fireIds = await checkBonusAwardMilestones(comp._id, comp.ticketsSold);
      console.log(
        "[bonus-award] runCheckBonusAwardMilestones: comp=%s fireIds=%s",
        comp.title,
        fireIds.join(",")
      );
      if (fireIds.length > 0) {
        triggered += fireIds.length;
        logger.info(
          `triggered ${fireIds.length} bonus award fire(s) for competition "${comp.title}"`
        );
        const pendingFires = await BonusAwardFire.find({
          competitionId: comp._id,
          status: "pending",
        }).lean();

        console.log(
          "[bonus-award] runCheckBonusAwardMilestones: comp=%s pendingFires=%d",
          comp.title,
          pendingFires.length
        );
        console.log(
          "[BONUS-DIAG] runCheckBonusAwardMilestones: comp=%s pendingFireDetails=%j",
          comp.title,
          pendingFires.map((f) => ({ id: f._id, status: f.status, pct: f.milestonePct }))
        );

        await pickPendingBonusAwardWinners(fireIds, async (wins) => {
          drawn += wins.length;
          console.log(
            "[bonus-award] runCheckBonusAwardMilestones: comp=%s drawn=%d wins",
            comp.title,
            wins.length
          );
          await notifyBonusAwardWins({
            wins,
            pendingFires,
            competitionName: comp.title ?? "Competition",
          });
        });
      }
    } catch (err) {
      logger.error(`error checking bonus awards for competition "${comp.title}":`, err);
    }
  }

  logger.info(
    `check complete: ${triggered} fires triggered, ${drawn} winners drawn across ${competitions.length} competitions`
  );
  return { triggered, drawn };
}

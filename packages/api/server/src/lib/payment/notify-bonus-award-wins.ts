import { BonusAwardWin, type IBonusAwardWin, Profile } from "@oc/api-db/models";
import { sendEmail } from "@oc/api-email/client";
import { getEmailConfig } from "@oc/api-email/config";
import BonusDrawWinEmail from "@oc/api-email/templates/bonus-draw-win";
import { getCurrentContext } from "@oc/api-infra/env";
import { createLogger } from "@oc/api-logger";
import { sendPushNotification } from "@oc/api-server/lib/push";
import { getDisplayName } from "@oc/utils";
import { render } from "@react-email/render";
import { Types } from "mongoose";

export interface NotifyBonusAwardWinsOptions {
  wins: IBonusAwardWin[];
  pendingFires: Array<{ _id: Types.ObjectId; milestonePct: number }>;
  competitionName: string;
}

export async function notifyBonusAwardWins(options: NotifyBonusAwardWinsOptions): Promise<void> {
  const { wins, pendingFires, competitionName } = options;

  console.log(
    "[bonus-award] notifyBonusAwardWins: notifying %d wins for competition=%s",
    wins.length,
    competitionName
  );
  console.log(
    "[BONUS-DIAG] notifyBonusAwardWins: entry winCount=%d competitionName=%s pendingFireCount=%d",
    wins.length,
    competitionName,
    pendingFires.length
  );

  const notifiedWinIds: Types.ObjectId[] = [];

  for (const [winIdx, win] of wins.entries()) {
    try {
      console.log(
        "[bonus-award] notifyBonusAwardWins: win[%d] userId=%s fireId=%s prizeTitle=%s",
        winIdx,
        win.userId,
        win.bonusAwardFireId,
        win.prizeTitle
      );
      const profile = await Profile.findById(win.userId).lean();
      if (!profile?.email) continue;

      console.log(
        "[bonus-award] notifyBonusAwardWins: win[%d] profile=%s email=%s isGuest=%s",
        winIdx,
        profile._id,
        profile.email,
        profile.email.endsWith("@guest.onlinecompetitions.local")
      );

      const isGuestEmail = profile.email.endsWith("@guest.onlinecompetitions.local");

      if (!isGuestEmail) {
        console.log(
          "[bonus-award] notifyBonusAwardWins: win[%d] sendingEmail=true (non-guest)",
          winIdx
        );
        const settings = await getEmailConfig();
        const { frontendUrl } = getCurrentContext();
        const userName = getDisplayName(profile, profile.email);
        const claimUrl = profile.isGuestCheckout
          ? `${frontendUrl}/auth/login?returnTo=/dashboard/wins`
          : `${frontendUrl}/dashboard/wins`;

        const fire = pendingFires.find((f) => f._id.equals(win.bonusAwardFireId));
        const milestonePct = fire?.milestonePct ?? 0;

        const emailHtml = await render(
          BonusDrawWinEmail({
            userName,
            competitionName,
            milestonePct,
            prizeTitle: win.prizeTitle,
            prizeValue: win.prizeValue,
            prizeImage: win.prizeImage ?? undefined,
            claimUrl,
            isGuest: profile.isGuestCheckout,
            settings,
          })
        );
        log.info(
          "[bonus-award] notifyBonusAwardWins: sending email to userId=%s fireId=%s",
          win.userId,
          win.bonusAwardFireId
        );
        await sendEmail({
          to: profile.email,
          subject: `🎉 You won a bonus draw!`,
          html: emailHtml,
        });

        console.log("[bonus-award] notifyBonusAwardWins: win[%d] emailSent", winIdx);
        notifiedWinIds.push(win._id);
      } else {
        console.log(
          "[bonus-award] notifyBonusAwardWins: win[%d] sendingEmail=false (guest)",
          winIdx
        );
      }

      console.log("[bonus-award] notifyBonusAwardWins: win[%d] sendingPushNotification", winIdx);
      if (!isGuestEmail) {
        void sendPushNotification(
          {
            title: "Bonus draw winner!",
            body: `You won ${win.prizeTitle}${win.prizeValue ? ` valued at £${win.prizeValue.toLocaleString()}` : ""}!`,
            type: "draw_result",
            url: "/dashboard/wins",
            tag: `bonus-${win._id}`,
          },
          { userId: win.userId.toString() }
        ).catch(() => {});
      }

      log.info(
        "[bonus-award] notifyBonusAwardWins: push sent to userId=%s fireId=%s",
        win.userId,
        win.bonusAwardFireId
      );
    } catch (winErr) {
      log.error("[bonus-award] Failed to notify winner:", winErr);
    }
  }

  if (notifiedWinIds.length > 0) {
    await BonusAwardWin.updateMany(
      { _id: { $in: notifiedWinIds } },
      { $set: { notifiedAt: new Date() } }
    ).catch((err) => {
      log.error("[bonus-award] Failed to batch update notifiedAt:", err);
    });
  }

  console.log(
    "[BONUS-DIAG] notifyBonusAwardWins: exit notified=%d totalWins=%d",
    notifiedWinIds.length,
    wins.length
  );
}

const log = createLogger("bonus-award");

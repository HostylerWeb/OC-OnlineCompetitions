import dbConnect from "@oc/api-infra/db";
import { recordReferralPurchase } from "@oc/api-referrals";

const REFEREES = [
  "6a5bc898ba74b3ef3dcbeb89",
  "6a5bc8f0ba74b3ef3dcbeb92",
  "6a5bc8f4ba74b3ef3dcbeb97",
  "6a5bc8f9ba74b3ef3dcbeb9c",
  "6a5bc8fdba74b3ef3dcbeba1",
  "6a5bc902ba74b3ef3dcbeba6",
  "6a5bc906ba74b3ef3dcbebab",
  "6a5bc90bba74b3ef3dcbebb0",
  "6a5bc90fba74b3ef3dcbebb5",
  "6a5bc914ba74b3ef3dcbebba",
  "6a5bc918ba74b3ef3dcbebbf",
  "6a5bc91cba74b3ef3dcbebc4",
  "6a5bc921ba74b3ef3dcbebc9",
  "6a5bc925ba74b3ef3dcbebce",
  "6a5bc92aba74b3ef3dcbebd3",
];

async function main() {
  await dbConnect();
  const base = `test-order-${Date.now()}`;
  for (let i = 0; i < REFEREES.length; i++) {
    try {
      await recordReferralPurchase({
        buyerUserId: REFEREES[i],
        orderId: `${base}-${i}`,
        quantity: 1,
        orderTotal: 2,
      });
      console.log(`[OK] ${i + 1}/15`);
    } catch (err) {
      console.log(`[ERR] ${i + 1}/15: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log("Done.");
  process.exit(0);
}
main();

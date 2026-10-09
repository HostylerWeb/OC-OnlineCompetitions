import { randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Order, Ticket } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";

const BATCH_SIZE = 500;

async function generateUniqueOrderNumber(): Promise<number> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = randomInt(1, 1_000_000_000_000);
    const exists = await Order.findOne({ orderNumber: candidate }, { _id: 1 }).lean();
    if (!exists) return candidate;
  }
  return randomInt(1, 1_000_000_000_000);
}

async function backfillTicketOrderNumbers(): Promise<number> {
  await dbConnect();

  const soldWithoutOrderNumber = await Ticket.countDocuments({
    status: "sold",
    orderNumber: { $exists: false },
  });
  console.log(`Found ${soldWithoutOrderNumber} sold tickets without orderNumber`);

  let processed = 0;

  // Phase 1: Tickets WITH orderId — look up the Order to copy its orderNumber
  const pipeline = Ticket.aggregate([
    {
      $match: {
        status: "sold",
        orderNumber: { $exists: false },
        orderId: { $exists: true, $ne: null },
      },
    },
    { $limit: 10000 },
    {
      $lookup: {
        from: "orders",
        localField: "orderId",
        foreignField: "_id",
        as: "order",
      },
    },
    { $unwind: { path: "$order", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        orderNumber: "$order.orderNumber",
      },
    },
  ]).option({ allowDiskUse: true });

  let batch: { _id: string; orderNumber: number }[] = [];
  for await (const doc of pipeline) {
    const d = doc as unknown as { _id: string; orderNumber?: number };
    if (d.orderNumber != null) {
      batch.push({ _id: d._id, orderNumber: d.orderNumber });
    }
    if (batch.length >= BATCH_SIZE) {
      await Ticket.bulkWrite(
        batch.map((b) => ({
          updateOne: {
            filter: { _id: b._id, orderNumber: { $exists: false } },
            update: { $set: { orderNumber: b.orderNumber } },
          },
        }))
      );
      processed += batch.length;
      console.log(`Phase 1: Backfilled ${processed} tickets from Order docs`);
      batch.length = 0;
    }
  }

  if (batch.length > 0) {
    await Ticket.bulkWrite(
      batch.map((b) => ({
        updateOne: {
          filter: { _id: b._id, orderNumber: { $exists: false } },
          update: { $set: { orderNumber: b.orderNumber } },
        },
      }))
    );
    processed += batch.length;
    console.log(`Phase 1: Backfilled ${processed} tickets from Order docs`);
  }

  // Phase 2: Tickets WITHOUT orderId — generate new order numbers directly
  const noOrderIdTickets = await Ticket.find({
    status: "sold",
    orderNumber: { $exists: false },
    $or: [{ orderId: { $exists: false } }, { orderId: null }],
  })
    .limit(10000)
    .select("_id")
    .lean();

  if (noOrderIdTickets.length > 0) {
    console.log(`Phase 2: Found ${noOrderIdTickets.length} tickets without orderId`);
    batch = [];
    for (const ticket of noOrderIdTickets) {
      const orderNumber = await generateUniqueOrderNumber();
      batch.push({ _id: ticket._id.toString(), orderNumber });
      if (batch.length >= BATCH_SIZE) {
        await Ticket.bulkWrite(
          batch.map((b) => ({
            updateOne: {
              filter: { _id: b._id, orderNumber: { $exists: false } },
              update: { $set: { orderNumber: b.orderNumber } },
            },
          }))
        );
        processed += batch.length;
        console.log(`Phase 2: Backfilled ${processed} tickets with generated numbers`);
        batch.length = 0;
      }
    }
    if (batch.length > 0) {
      await Ticket.bulkWrite(
        batch.map((b) => ({
          updateOne: {
            filter: { _id: b._id, orderNumber: { $exists: false } },
            update: { $set: { orderNumber: b.orderNumber } },
          },
        }))
      );
      processed += batch.length;
    }
    console.log(`Phase 2: Backfilled ${noOrderIdTickets.length} prize tickets`);
  }

  console.log(`Done. Backfilled ${processed} tickets total.`);
  return processed;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  backfillTicketOrderNumbers()
    .then((n) => {
      console.log(`Backfill complete: ${n} tickets updated`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Backfill failed:", err);
      process.exit(1);
    });
}

export { backfillTicketOrderNumbers };

import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI ?? "mongodb://localhost:27017/onlinecompetitions";

async function migrate() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  if (!db) {
    console.error("No database connection");
    process.exit(1);
  }

  const result = await db.collection("profiles").updateMany(
    {
      $or: [
        { showLastName: { $ne: true } },
        { showLocation: { $ne: true } },
        { showSocials: { $ne: true } },
      ],
    },
    {
      $set: {
        showLastName: true,
        showLocation: true,
        showSocials: true,
      },
    }
  );

  console.log(`Updated ${result.modifiedCount} profiles to opt-out privacy defaults`);

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

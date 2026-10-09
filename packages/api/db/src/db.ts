import dbConnect from "@oc/api-infra/db";
import mongoose, { type Model } from "mongoose";

export default dbConnect;

export function m<T>(name: string, schema: mongoose.Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

mongoose.connection.on("connected", async () => {
  try {
    await mongoose.connection
      .db!.collection("session")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    console.log("[mongo] session TTL index created");
  } catch (err) {
    console.warn(
      "[mongo] session TTL index creation failed:",
      err instanceof Error ? err.message : String(err)
    );
  }
});

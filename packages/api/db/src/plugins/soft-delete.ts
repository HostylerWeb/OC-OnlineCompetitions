import mongoose, { type Document, type Model, type Query, Schema, type Types } from "mongoose";

export interface ISoftDelete {
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}

export interface SoftDeleteModel<T extends Document> extends Model<T> {
  softDelete(
    id: Types.ObjectId | string,
    userId?: Types.ObjectId | string
  ): Promise<(T & { _id: Types.ObjectId }) | null>;
  restore(id: Types.ObjectId | string): Promise<(T & { _id: Types.ObjectId }) | null>;
  findDeleted(): Query<(T & Document)[], T & Document, Record<string, never>, T>;
  includeDeleted(): Query<(T & Document)[], T & Document, Record<string, never>, T>;
}

/**
 * Query option that opts a single query out of the automatic `deletedAt: null`
 * filter. Exported so callers that must see soft-deleted rows — for example to
 * free a unique index slot one still occupies — can set it explicitly.
 */
export const SOFT_DELETE_FLAG = "onlinecompetitions_softDeleteIncluded" as const;

export function softDeletePlugin(schema: Schema): void {
  schema.add({
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "Profile", default: null },
  });

  schema.index({ deletedAt: 1 });

  function shouldSkipFilter(options: mongoose.QueryOptions): boolean {
    return !!(options as Record<string, unknown>)[SOFT_DELETE_FLAG];
  }

  const addFilter = function (this: Query<unknown, unknown>) {
    if (!shouldSkipFilter(this.getOptions())) {
      this.where({ deletedAt: null });
    }
  };

  schema.pre("find", addFilter);
  schema.pre("findOne", addFilter);
  schema.pre("findOneAndUpdate", addFilter);
  schema.pre("countDocuments", addFilter);
  schema.pre("updateOne", addFilter);
  schema.pre("updateMany", addFilter);
  schema.pre("deleteOne", addFilter);
  schema.pre("deleteMany", addFilter);
  schema.pre("findOneAndDelete", addFilter);
  schema.pre("findOneAndReplace", addFilter);
  schema.pre("replaceOne", addFilter);

  schema.static(
    "softDelete",
    async function (
      this: Model<Document>,
      id: Types.ObjectId | string,
      userId?: Types.ObjectId | string
    ) {
      const update: Record<string, unknown> = { deletedAt: new Date() };
      if (userId) {
        update.deletedBy =
          userId instanceof mongoose.Types.ObjectId ? userId : new mongoose.Types.ObjectId(userId);
      }
      return this.findByIdAndUpdate(id, { $set: update }, { returnDocument: "after" });
    }
  );

  schema.static("restore", async function (this: Model<Document>, id: Types.ObjectId | string) {
    return this.findByIdAndUpdate(id, { $set: { deletedAt: null, deletedBy: null } }, {
      returnDocument: "after",
      [SOFT_DELETE_FLAG]: true,
    } as mongoose.QueryOptions);
  });

  schema.static("findDeleted", function (this: Model<Document>) {
    return this.find({ deletedAt: { $ne: null } }).setOptions({
      [SOFT_DELETE_FLAG]: true,
    } as mongoose.QueryOptions);
  });

  schema.static("includeDeleted", function (this: Model<Document>) {
    return this.find().setOptions({
      [SOFT_DELETE_FLAG]: true,
    } as mongoose.QueryOptions);
  });
}

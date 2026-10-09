import { Ticket } from "@oc/api-db/models";
import mongoose, { Types } from "mongoose";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import {
  buildExcludeSetForInstantPrizes,
  countTakenFromPool,
  getMinimumAllowedMaxTickets,
  pickAvailableNumbers,
} from "./ticket-service";

describe("ticket-service (api-tickets)", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.DATABASE_URL ?? "");
    }
  });

  beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
      const coll = collections[key];
      if (coll) await coll.deleteMany({});
    }
  });

  describe("countTakenFromPool", () => {
    test("returns 0 for an empty competition", async () => {
      const compId = new Types.ObjectId();
      const result = await countTakenFromPool(compId.toHexString());
      expect(result).toBe(0);
    });

    test("counts sold + held + reserved but not available", async () => {
      const compId = new Types.ObjectId();
      const docs = [
        { status: "available", number: 1 },
        { status: "sold", number: 2 },
        { status: "held", number: 3 },
        { status: "reserved", number: 4 },
        { status: "sold", number: 5 },
      ];
      await Ticket.insertMany(
        docs.map((d) => ({
          _id: new Types.ObjectId(),
          competitionId: compId,
          number: d.number,
          status: d.status,
          shuffleKey: d.number,
        }))
      );

      const result = await countTakenFromPool(compId.toHexString());
      expect(result).toBe(4);
    });
  });

  describe("pickAvailableNumbers", () => {
    test("picks the requested quantity from the available pool, sorted by shuffleKey", async () => {
      const compId = new Types.ObjectId();
      const tickets = Array.from({ length: 10 }, (_, i) => ({
        _id: new Types.ObjectId(),
        competitionId: compId,
        number: i + 1,
        status: "available" as const,
        shuffleKey: 100 - i,
      }));
      await Ticket.insertMany(tickets);

      const picked = await pickAvailableNumbers(compId.toHexString(), 3);
      expect(picked).toHaveLength(3);
      expect(picked.every((n) => n >= 1 && n <= 10)).toBe(true);
    });

    test("respects the exclude set and skips already-taken numbers", async () => {
      const compId = new Types.ObjectId();
      await Ticket.insertMany(
        [1, 2, 3, 4, 5].map((n) => ({
          _id: new Types.ObjectId(),
          competitionId: compId,
          number: n,
          status: "available" as const,
          shuffleKey: n,
        }))
      );

      const picked = await pickAvailableNumbers(compId.toHexString(), 2, new Set([1, 3, 5]));
      expect(picked).toHaveLength(2);
      expect(picked).not.toContain(1);
      expect(picked).not.toContain(3);
      expect(picked).not.toContain(5);
    });

    test("throws when there are not enough available tickets", async () => {
      const compId = new Types.ObjectId();
      await Ticket.insertMany([
        {
          _id: new Types.ObjectId(),
          competitionId: compId,
          number: 1,
          status: "available" as const,
          shuffleKey: 1,
        },
      ]);

      await expect(pickAvailableNumbers(compId.toHexString(), 5)).rejects.toThrow(
        /Not enough available tickets/
      );
    });
  });

  describe("getMinimumAllowedMaxTickets", () => {
    test("returns 0 for a brand-new competition with no tickets", async () => {
      const compId = new Types.ObjectId();
      const result = await getMinimumAllowedMaxTickets(compId.toHexString());
      expect(result).toBe(0);
    });
  });

  describe("buildExcludeSetForInstantPrizes", () => {
    test("returns an empty set for a fresh competition", async () => {
      const compId = new Types.ObjectId();
      const exclude = await buildExcludeSetForInstantPrizes(compId.toHexString());
      expect(exclude.size).toBe(0);
    });

    test("includes all sold/held/reserved ticket numbers", async () => {
      const compId = new Types.ObjectId();
      await Ticket.insertMany([
        {
          _id: new Types.ObjectId(),
          competitionId: compId,
          number: 7,
          status: "sold" as const,
          shuffleKey: 1,
        },
        {
          _id: new Types.ObjectId(),
          competitionId: compId,
          number: 13,
          status: "held" as const,
          shuffleKey: 2,
        },
      ]);

      const exclude = await buildExcludeSetForInstantPrizes(compId.toHexString());
      expect(exclude.has(7)).toBe(true);
      expect(exclude.has(13)).toBe(true);
    });
  });
});

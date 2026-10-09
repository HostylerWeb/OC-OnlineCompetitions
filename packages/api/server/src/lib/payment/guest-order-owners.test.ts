import { Types } from "mongoose";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { resolveOrderReadScope } from "./guest-order-owners";

vi.mock("@oc/auth-admin/auth-hooks", () => ({
  canonicalizeEmail: (email: string) => {
    const parts = email.toLowerCase().split("@");
    const local = parts[0]!;
    const domain = parts[1];
    if (!domain) return email;
    if (domain === "gmail.com" || domain === "googlemail.com") {
      return `${local.replace(/\./g, "").split("+")[0]}@gmail.com`;
    }
    return `${local.split("+")[0]}@${domain}`;
  },
}));

const __profileFindById = vi.fn();
const __profileFind = vi.fn();

vi.mock("@oc/api-db/models", () => ({
  Profile: {
    findById: (id: unknown) => ({
      select: () => ({ lean: async () => __profileFindById(id) }),
    }),
    find: (query: unknown) => ({
      select: () => ({ lean: async () => __profileFind(query) }),
    }),
  },
}));

describe("resolveOrderReadScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns only the session user when the profile is missing", async () => {
    __profileFindById.mockResolvedValue(null);

    const sessionUserId = new Types.ObjectId().toString();
    const scope = await resolveOrderReadScope(sessionUserId);

    expect(scope.userIds).toEqual([sessionUserId]);
    expect(scope.emails).toEqual([]);
    expect(__profileFind).not.toHaveBeenCalled();
  });

  test("skips email resolution for anonymous guest profiles", async () => {
    __profileFindById.mockResolvedValue({
      _id: new Types.ObjectId(),
      email: "guest-abc123@guest.onlinecompetitions.local",
    });

    const sessionUserId = new Types.ObjectId().toString();
    const scope = await resolveOrderReadScope(sessionUserId);

    expect(scope.userIds).toEqual([sessionUserId]);
    expect(scope.emails).toEqual([]);
    expect(__profileFind).not.toHaveBeenCalled();
  });

  test("includes the canonicalized checkout email and same-email profile owners", async () => {
    const sessionUserId = new Types.ObjectId().toString();
    const ownerId = new Types.ObjectId();
    __profileFindById.mockResolvedValue({
      _id: new Types.ObjectId(sessionUserId),
      email: "Person@Example.com",
    });
    __profileFind.mockResolvedValue([{ _id: ownerId }]);

    const scope = await resolveOrderReadScope(sessionUserId);

    expect(scope.emails).toEqual(["person@example.com"]);
    expect(scope.userIds).toEqual([sessionUserId, ownerId.toString()]);
    expect(__profileFind).toHaveBeenCalledWith(
      expect.objectContaining({ email: "person@example.com" })
    );
    expect(JSON.stringify(__profileFind.mock.calls[0]![0])).toContain(sessionUserId);
  });

  test("canonicalizes gmail aliases and excludes the session user itself", async () => {
    const sessionUserId = new Types.ObjectId().toString();
    __profileFindById.mockResolvedValue({
      _id: new Types.ObjectId(sessionUserId),
      email: "Foo.Bar+tag@gmail.com",
    });
    __profileFind.mockResolvedValue([{ _id: new Types.ObjectId(sessionUserId) }]);

    const scope = await resolveOrderReadScope(sessionUserId);

    expect(scope.emails).toEqual(["foobar@gmail.com"]);
    expect(scope.userIds).toEqual([sessionUserId]);
  });
});
import { randomBytes } from "node:crypto";
import { dbConnect } from "@oc/api-db";
import { Profile } from "@oc/api-db/models";
import { SetupError } from "@oc/api-errors";
import { invalidateUser } from "@oc/api-infra/cache";
import { getAdminAuth } from "@oc/auth-admin/admin-auth";
import { secretsEqual } from "@oc/auth-admin/secret-compare";
import { createOnlineCompetitionsProfile } from "@oc/auth-admin/auth-hooks";
import { getMongoDb } from "@oc/auth-admin/auth-mongo";
import { getEnv } from "@oc/env/server";
import { APIError } from "better-auth/api";

const SETUP_SECRET_HEADER = "x-setup-secret";

export type AdminSetupStatus = {
  available: boolean;
  requiresSecret: boolean;
  defaultEmail: string | null;
};

export type AdminSetupResult = {
  email: string;
  password: string;
};

function getConfiguredSetupSecret(): string | null {
  const secret = getEnv("SETUP_SECRET")?.trim();
  return secret || null;
}

function getConfiguredSetupEmail(): string | null {
  const email = getEnv("ADMIN_SETUP_EMAIL")?.trim().toLowerCase();
  return email || null;
}

export function setupRequiresSecret(): boolean {
  return getConfiguredSetupSecret() !== null;
}

export function validateSetupSecret(headerValue: string | undefined): boolean {
  const secret = getConfiguredSetupSecret();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  return secretsEqual(headerValue, secret);
}

export function getSetupSecretHeaderName(): string {
  return SETUP_SECRET_HEADER;
}

export function generateSetupPassword(length = 24): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
}

async function repairAdminProfile(userId: string, email: string): Promise<void> {
  await dbConnect();

  const profile = await Profile.findById(userId);
  if (!profile) {
    await createOnlineCompetitionsProfile({
      id: userId,
      email,
      name: "Admin",
      emailVerified: true,
      role: "admin",
      firstName: "Admin",
    });
    return;
  }

  await Profile.findByIdAndUpdate(userId, {
    email,
    isAdmin: true,
    isVerified: true,
  });
  void invalidateUser(userId).catch(() => {});
}

export async function upsertAdminAccount(email: string): Promise<AdminSetupResult> {
  await dbConnect();

  const normalizedEmail = email.trim().toLowerCase();
  const password = generateSetupPassword();
  const auth = await getAdminAuth();
  const ctx = await auth.$context;

  const existing = await ctx.internalAdapter.findUserByEmail(normalizedEmail, {
    includeAccounts: true,
  });

  let userId: string;

  if (!existing?.user) {
    try {
      const result = await auth.api.createUser({
        body: {
          email: normalizedEmail,
          password,
          name: "Admin",
          role: "admin",
          data: {
            emailVerified: true,
            firstName: "Admin",
          },
        },
      });
      userId = result.user.id;
    } catch (err: unknown) {
      if (err instanceof APIError) {
        throw new SetupError("VALIDATION_ERROR", err.message, err.statusCode ?? 400);
      }
      throw err;
    }
  } else {
    userId = existing.user.id;
    const hashedPassword = await ctx.password.hash(password);

    await ctx.internalAdapter.updateUser(userId, {
      role: "admin",
      emailVerified: true,
      name: existing.user.name ?? "Admin",
      firstName: existing.user.firstName ?? "Admin",
      banned: false,
      banExpires: null,
      banReason: null,
      updatedAt: new Date(),
    });

    const credentialAccount = existing.accounts?.find(
      (account: { providerId: string }) => account.providerId === "credential"
    );

    if (credentialAccount) {
      await ctx.internalAdapter.updatePassword(userId, hashedPassword);
    } else {
      await ctx.internalAdapter.linkAccount({
        accountId: userId,
        providerId: "credential",
        password: hashedPassword,
        userId,
      });
    }

    await ctx.internalAdapter.deleteSessions(userId);
  }

  await repairAdminProfile(userId, normalizedEmail);

  return { email: normalizedEmail, password };
}

async function countAuthAdminUsers(): Promise<number> {
  const db = getMongoDb();
  return db.collection("user").countDocuments({
    $or: [
      { role: { $in: ["admin", "manager"] } },
      { role: { $regex: /(^|,)(admin|manager)(,|$)/ } },
    ],
  });
}

export async function hasExistingAdmin(): Promise<boolean> {
  await dbConnect();

  const [profileAdminCount, authAdminCount] = await Promise.all([
    Profile.countDocuments({
      $or: [
        { isAdmin: true, role: { $in: ["admin", "manager"] } },
        { isAdmin: true, role: { $exists: false } },
      ],
    }),
    countAuthAdminUsers(),
  ]);

  return profileAdminCount > 0 || authAdminCount > 0;
}

export async function getAdminSetupStatus(): Promise<AdminSetupStatus> {
  const available = !(await hasExistingAdmin());
  return {
    available,
    requiresSecret: setupRequiresSecret(),
    defaultEmail: getConfiguredSetupEmail(),
  };
}

function resolveSetupEmail(requestEmail: string | undefined): string | null {
  const configured = getConfiguredSetupEmail();
  const normalizedRequest = requestEmail?.trim().toLowerCase();

  if (configured) return configured;
  if (normalizedRequest) return normalizedRequest;

  return null;
}

export async function bootstrapAdmin(input: {
  email?: string;
  setupSecret?: string;
}): Promise<AdminSetupResult> {
  if (await hasExistingAdmin()) {
    throw new SetupError("CONFLICT", "An admin account already exists. Setup is disabled.", 409);
  }

  if (!validateSetupSecret(input.setupSecret)) {
    throw new SetupError("FORBIDDEN", "Invalid or missing setup secret.", 403);
  }

  const email = resolveSetupEmail(input.email);
  if (!email) {
    throw new SetupError(
      "VALIDATION_ERROR",
      "Set ADMIN_SETUP_EMAIL or provide an email when SETUP_SECRET is configured.",
      400
    );
  }

  const result = await upsertAdminAccount(email);
  console.log(JSON.stringify({ event: "admin_setup_completed", email: result.email }));
  return result;
}

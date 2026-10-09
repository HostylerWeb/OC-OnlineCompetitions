import { updateProfileFromSignUp } from "@oc/auth-admin/auth-hooks";
import type { AuthMiddleware } from "better-auth/api";
import { createAuthMiddleware } from "better-auth/api";

export type SignUpEmailBody = {
  email?: string;
  password?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
};

export function parseNameFields(body: SignUpEmailBody): {
  firstName?: string;
  lastName?: string;
} {
  const firstName = body.firstName?.trim() || undefined;
  const lastName = body.lastName?.trim() || undefined;

  if (firstName || lastName !== undefined) {
    return { firstName, lastName };
  }

  const name = body.name?.trim();
  if (!name) return {};

  const parts = name.split(/\s+/);
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
  };
}

export async function upsertUnverifiedSignUp(
  ctx: {
    password: { hash: (password: string) => Promise<string> };
    internalAdapter: {
      updateUser: (userId: string, data: Record<string, unknown>) => Promise<unknown>;
      updatePassword: (userId: string, passwordHash: string) => Promise<void>;
      linkAccount: (data: {
        userId: string;
        providerId: string;
        accountId: string;
        password: string;
      }) => Promise<unknown>;
      findAccounts: (userId: string) => Promise<Array<{ providerId: string }>>;
    };
  },
  userId: string,
  body: SignUpEmailBody
): Promise<void> {
  const email = body.email!.trim().toLowerCase();
  const password = body.password!;
  const name = body.name?.trim() || email.split("@")[0] || "User";
  const { firstName, lastName } = parseNameFields(body);
  const passwordHash = await ctx.password.hash(password);

  await ctx.internalAdapter.updateUser(userId, {
    name,
    ...(firstName ? { firstName } : {}),
    ...(lastName !== undefined ? { lastName: lastName ?? null } : {}),
    updatedAt: new Date(),
  });

  const accounts = await ctx.internalAdapter.findAccounts(userId);
  const credentialAccount = accounts.find((account) => account.providerId === "credential");

  if (credentialAccount) {
    await ctx.internalAdapter.updatePassword(userId, passwordHash);
  } else {
    await ctx.internalAdapter.linkAccount({
      userId,
      providerId: "credential",
      accountId: userId,
      password: passwordHash,
    });
  }

  await updateProfileFromSignUp(userId, {
    email,
    firstName,
    lastName,
    dateOfBirth: body.dateOfBirth?.trim(),
    emailVerified: false,
  });
}

export function createUnverifiedSignUpUpsertHook(): AuthMiddleware {
  return createAuthMiddleware(async (ctx) => {
    if (ctx.path !== "/sign-up/email") return;

    const body = ctx.body as SignUpEmailBody | undefined;
    if (!body) return;

    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const name = body.name?.trim();

    if (!email || !password || !name) return;

    const dbUser = await ctx.context.internalAdapter.findUserByEmail(email);
    if (!dbUser?.user || dbUser.user.emailVerified) return;

    await upsertUnverifiedSignUp(ctx.context, dbUser.user.id, {
      ...body,
      email,
      password,
      name,
    });
  });
}

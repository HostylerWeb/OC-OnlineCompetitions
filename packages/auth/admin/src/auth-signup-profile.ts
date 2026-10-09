import { updateProfileFromSignUp } from "@oc/auth-admin/auth-hooks";
import { parseNameFields, type SignUpEmailBody } from "@oc/auth-admin/auth-signup-upsert";
import type { AuthMiddleware } from "better-auth/api";
import { createAuthMiddleware } from "better-auth/api";

export function createSignUpProfileAfterHook(): AuthMiddleware {
  return createAuthMiddleware(async (ctx) => {
    if (ctx.path !== "/sign-up/email") return ctx;

    const body = ctx.body as SignUpEmailBody | undefined;
    const email = body?.email?.trim().toLowerCase();
    if (!email) return ctx;

    const dbUser = await ctx.context.internalAdapter.findUserByEmail(email);
    const userId = dbUser?.user?.id;
    if (!userId) return ctx;

    const { firstName, lastName } = parseNameFields(body ?? {});
    const dateOfBirth = body?.dateOfBirth?.trim();

    const { reassignGuestOrdersByEmail } = await import("@oc/auth-admin/auth-hooks");
    const guestData = await reassignGuestOrdersByEmail(email, userId);
    const prefilledFirstName = firstName || guestData?.firstName;
    const prefilledLastName = lastName || guestData?.lastName;

    if (!prefilledFirstName && prefilledLastName === undefined && !dateOfBirth) return ctx;

    await updateProfileFromSignUp(userId, {
      email,
      firstName: prefilledFirstName,
      lastName: prefilledLastName,
      dateOfBirth,
      emailVerified: dbUser.user.emailVerified ?? false,
    });

    return ctx;
  });
}

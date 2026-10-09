import { mergeGuestProfileIntoVerifiedUser } from "@oc/auth-admin/auth-hooks";
import type { AuthMiddleware } from "better-auth/api";
import { createAuthMiddleware } from "better-auth/api";

export function createGoogleOAuthGuestMergeHook(): AuthMiddleware {
  return createAuthMiddleware(async (ctx) => {
    if (ctx.path !== "/callback/google") return ctx;

    const newSession = ctx.context.newSession;
    if (!newSession?.user) return ctx;
    const newUser = newSession.user;
    if (newUser.isAnonymous) return ctx;
    if (!newUser.email) return ctx;

    try {
      const result = await mergeGuestProfileIntoVerifiedUser(newUser.email, newUser.id);
      if (result.merged) {
        console.log("[GoogleOAuthMerge] Merged guest profile for verified user", {
          userId: newUser.id,
          email: newUser.email,
          guestId: result.guestId,
        });
      }
    } catch (err) {
      console.error("[GoogleOAuthMerge] Failed to merge guest profile:", err);
    }

    return ctx;
  });
}

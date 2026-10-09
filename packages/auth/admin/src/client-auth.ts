import { sendMagicLinkEmail, sendOtpEmail, trySendWelcomeEmail } from "@oc/auth-admin/auth-email";
import { createGoogleOAuthGuestMergeHook } from "@oc/auth-admin/auth-google-oauth";
import { mergeAnonymousAccount } from "@oc/auth-admin/auth-hooks";
import { createSignUpProfileAfterHook } from "@oc/auth-admin/auth-signup-profile";
import { createUnverifiedSignUpUpsertHook } from "@oc/auth-admin/auth-signup-upsert";
import { getEnv } from "@oc/env/server";
import { getSessionCookiePrefix } from "@oc/utils";
import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { admin, anonymous, captcha, emailOTP, magicLink } from "better-auth/plugins";
import { type BuildAuthConfig, buildAuth } from "./build-auth";
import { createTrustedOriginsResolver } from "./trusted-origins";

const getAppUrl = () => getEnv("APP_URL").replace(/\/$/, "");

function getTrustedOrigins() {
  return createTrustedOriginsResolver(getAppUrl());
}

let authInstance: any;

export async function getClientAuth() {
  if (!authInstance) {
    const config: BuildAuthConfig = {
      appName: "Online Competitions",
      baseURL: getAppUrl(),
      trustedOrigins: getTrustedOrigins(),
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        async onExistingUserSignUp({ user }) {
          if (user.emailVerified) {
            throw APIError.from("UNPROCESSABLE_ENTITY", {
              code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
              message: "An account with this email already exists. Please sign in.",
            });
          }
        },
      },
      emailVerification: {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
      },
      account: {
        accountLinking: {
          enabled: true,
          trustedProviders: ["google"],
          updateUserInfoOnLink: true,
        },
      },
      plugins: [
        emailOTP({
          overrideDefaultEmailVerification: true,
          expiresIn: 900,
          allowedAttempts: 5,
          resendStrategy: "rotate",
          sendVerificationOnSignUp: true,
          async sendVerificationOTP({ email, otp, type }) {
            if (type === "change-email") return;
            void sendOtpEmail({ email, otp, type }).catch(() => {});
          },
        }),
        magicLink({
          expiresIn: 900,
          async sendMagicLink({ email, url, token }) {
            const parsed = new URL(url);
            parsed.pathname = "/auth/verify-magic-link";
            void sendMagicLinkEmail({ email, url: parsed.toString(), token }).catch(() => {});
          },
        }),
        anonymous({
          onLinkAccount: async ({ anonymousUser, newUser }) => {
            await mergeAnonymousAccount({
              anonymousUser: {
                id: anonymousUser.user.id,
                email: anonymousUser.user.email,
                isAnonymous: true,
              },
              newUser: { id: newUser.user.id, email: newUser.user.email, isAnonymous: false },
            });
          },
          generateRandomEmail: () => {
            const id = crypto.randomUUID();
            return `guest-${id}@guest.onlinecompetitions.local`;
          },
        }),
        admin({ defaultRole: "user", adminRoles: ["admin"] }),
        captcha({
          provider: "cloudflare-turnstile",
          secretKey: getEnv("TURNSTILE_SECRET_KEY"),
        }),
      ],
      hooks: {
        before: createUnverifiedSignUpUpsertHook(),
        after: (() => {
          const signUpHook = createSignUpProfileAfterHook();
          const googleHook = createGoogleOAuthGuestMergeHook();
          return async (ctx) => {
            await signUpHook(ctx);
            await googleHook(ctx);
            return ctx;
          };
        })(),
      },
      socialProviders: getSocialProviders(),
      advanced: {
        cookiePrefix: getSessionCookiePrefix(getAppUrl(), "client"),
      },
      rateLimit: {
        customRules: {
          "*/get-session": () => false,
        },
      },
      onAPIErrorURL: `${getAppUrl()}/auth/error`,
      onUserEmailVerified: trySendWelcomeEmail,
    };
    authInstance = betterAuth(buildAuth(config));
  }
  return authInstance;
}

function getSocialProviders() {
  const googleClientId = getEnv("GOOGLE_CLIENT_ID");
  const googleClientSecret = getEnv("GOOGLE_CLIENT_SECRET");
  if (!googleClientId || !googleClientSecret) return {};
  return {
    google: {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      redirectURI: `${getAppUrl()}/api/auth/callback/google`,
      disableImplicitSignUp: true,
      mapProfileToUser: (profile: {
        name: string;
        email: string;
        picture?: string;
        given_name?: string;
        family_name?: string;
      }) => ({
        name: profile.name,
        email: profile.email,
        image: profile.picture,
        firstName: profile.given_name,
        lastName: profile.family_name,
      }),
    },
  };
}

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: boolean;
  isAnonymous?: boolean | null;
  role?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export type AuthSessionData = {
  userId: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
};

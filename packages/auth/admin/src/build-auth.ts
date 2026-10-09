import { runtimeConfig } from "@oc/api-infra/runtime-config";
import {
  createOnlineCompetitionsProfile,
  type HookAuthUser,
  syncProfileFromAuthUser,
} from "@oc/auth-admin/auth-hooks";
import { getMongoDb } from "@oc/auth-admin/auth-mongo";
import { getBool, getEnv, getNum } from "@oc/env/server";
import type { BetterAuthOptions } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";

export interface BuildAuthConfig {
  appName: string;
  baseURL: string;
  trustedOrigins:
    | string[]
    | ((
        request?: Request
      ) => (string | null | undefined)[] | Promise<(string | null | undefined)[]>);
  emailAndPassword?: {
    enabled: boolean;
    requireEmailVerification?: boolean;
    onExistingUserSignUp?: (opts: { user: { emailVerified: boolean } }) => Promise<void>;
  };
  emailVerification?: {
    sendOnSignUp?: boolean;
    autoSignInAfterVerification?: boolean;
  };
  session?: {
    modelName?: string;
    storeSessionInDatabase?: boolean;
  };
  user?: {
    modelName?: string;
  };
  account?: {
    modelName?: string;
    accountLinking?: {
      enabled: boolean;
      trustedProviders?: string[];
      updateUserInfoOnLink?: boolean;
    };
  };
  verification?: {
    modelName?: string;
  };
  plugins: BetterAuthOptions["plugins"];
  hooks?: BetterAuthOptions["hooks"];
  socialProviders?: BetterAuthOptions["socialProviders"];
  onUserEmailVerified?: (user: HookAuthUser) => Promise<void>;
  onAPIErrorURL: string;
  rateLimit?: Record<string, unknown>;
  advanced?: Record<string, unknown>;
}

export function buildAuth(config: BuildAuthConfig): BetterAuthOptions {
  return {
    appName: config.appName,
    secret: getEnv("BETTER_AUTH_SECRET"),
    baseURL: config.baseURL,
    trustedOrigins: config.trustedOrigins,
    database: mongodbAdapter(getMongoDb()),
    session: {
      storeSessionInDatabase: true,
      ...config.session,
    },
    emailAndPassword: config.emailAndPassword,
    emailVerification: config.emailVerification,
    user: {
      additionalFields: {
        firstName: { type: "string" as const, required: false, input: true },
        lastName: { type: "string" as const, required: false, input: true },
      },
      ...config.user,
    },
    account: config.account,
    verification: config.verification,
    plugins: config.plugins,
    databaseHooks: {
      user: {
        create: {
          after: async (user: HookAuthUser) => {
            await createOnlineCompetitionsProfile(user);
            if (user.emailVerified && config.onUserEmailVerified) {
              void config.onUserEmailVerified(user).catch((err) => {
                console.error("[AUTH] onUserEmailVerified failed:", err);
              });
            }
          },
        },
        update: {
          after: async (user: HookAuthUser) => {
            if (user.emailVerified && config.onUserEmailVerified) {
              void config.onUserEmailVerified(user).catch((err) => {
                console.error("[AUTH] onUserEmailVerified failed:", err);
              });
            }
            await syncProfileFromAuthUser(user);
          },
        },
      },
    },
    hooks: config.hooks,
    rateLimit: {
      enabled: getNum("RATE_LIMIT_AUTH", process.env.NODE_ENV === "production" ? 1 : 0) > 0,
      storage: "memory" as const,
      window: 60,
      max: 20,
      ...config.rateLimit,
    },
    advanced: {
      useSecureCookies: runtimeConfig.secureCookies,
      crossSubDomainCookies: { enabled: getBool("CROSS_SUBDOMAIN_COOKIES") },
      defaultCookieAttributes: { sameSite: runtimeConfig.secureCookies ? "none" : "lax" },
      ...config.advanced,
    },
    socialProviders: config.socialProviders,
    onAPIError: { errorURL: config.onAPIErrorURL },
  };
}

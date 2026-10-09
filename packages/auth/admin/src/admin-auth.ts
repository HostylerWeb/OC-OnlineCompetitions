import { getEnv } from "@oc/env/server";
import { getSessionCookiePrefix } from "@oc/utils";
import { betterAuth } from "better-auth/minimal";
import { admin, captcha, emailOTP } from "better-auth/plugins";
import { defaultRoles, userAc } from "better-auth/plugins/admin/access";
import { type BuildAuthConfig, buildAuth } from "./build-auth";
import { createTrustedOriginsResolver } from "./trusted-origins";

const getAppUrl = () => getEnv("APP_URL").replace(/\/$/, "");

let authInstance: any;

function getSocialProviders() {
  const googleClientId = getEnv("GOOGLE_CLIENT_ID");
  const googleClientSecret = getEnv("GOOGLE_CLIENT_SECRET");
  if (!googleClientId || !googleClientSecret) return {};
  return {
    google: {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      redirectURI: `${getAppUrl()}/api/auth/callback/google`,
      scope: [
        "openid",
        "profile",
        "email",
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.file",
      ],
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

export async function getAdminAuth() {
  if (!authInstance) {
    const config: BuildAuthConfig = {
      appName: "Online Competitions Admin",
      baseURL: getAppUrl(),
      trustedOrigins: createTrustedOriginsResolver(getAppUrl()),
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
      },
      socialProviders: getSocialProviders(),
      account: {
        accountLinking: {
          enabled: true,
          trustedProviders: ["google"],
        },
      },
      plugins: [
        admin({
          defaultRole: "user",
          adminRoles: ["admin", "manager"],
          roles: { ...defaultRoles, manager: userAc },
        }),
        emailOTP({
          overrideDefaultEmailVerification: true,
          expiresIn: 900,
          allowedAttempts: 5,
          resendStrategy: "rotate",
          sendVerificationOnSignUp: true,
          async sendVerificationOTP({ email, otp, type }) {
            if (type === "change-email") return;
            const { sendOtpEmail } = await import("./auth-email");
            void sendOtpEmail({ email, otp, type }).catch(() => {});
          },
        }),
        captcha({
          provider: "cloudflare-turnstile",
          secretKey: getEnv("TURNSTILE_SECRET_KEY"),
        }),
      ],
      advanced: {
        cookiePrefix: getSessionCookiePrefix(getAppUrl(), "admin"),
      },
      rateLimit: {
        customRules: {
          "*/get-session": () => false,
        },
      },
      onAPIErrorURL: `${getAppUrl()}/auth/error`,
    };
    authInstance = betterAuth(buildAuth(config));
  }
  return authInstance;
}

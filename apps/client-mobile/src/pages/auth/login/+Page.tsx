import {
  applyAuthenticatedDestination,
  authClient,
  isAdminUser,
  resolveAuthenticatedDestination,
  SignInForm,
  useReturnToSearchParam,
} from "@oc/api-client";
import { useTranslation } from "@/lib/i18n";

const getEnv = (key: string) => import.meta.env[`VITE_${key}`] || "";
export default function LoginPage() {
  const { t } = useTranslation();
  const { returnTo, callbackURL } = useReturnToSearchParam();

  async function handleSuccess() {
    const session = await authClient.getSession();
    applyAuthenticatedDestination(
      resolveAuthenticatedDestination({
        returnTo,
        isAdmin: isAdminUser(session.data?.user),
        adminUrl: getEnv("ADMIN_URL"),
      }),
      (path: string) => {
        if (typeof window !== "undefined") window.location.href = path;
      }
    );
  }

  return (
    <div className="h-full overflow-y-auto flex flex-col justify-center px-4">
      <h1 className="text-2xl font-bold text-foreground mb-1">{t("auth.login.heading")}</h1>
      <p className="text-muted-foreground mb-6">{t("auth.login.subtitle")}</p>
      <SignInForm
        callbackURL={callbackURL}
        onSuccess={handleSuccess}
        turnstileSiteKey={getEnv("TURNSTILE_SITE_KEY") || undefined}
        localize={t as (key: string, params?: Record<string, string | number>) => string}
      />
    </div>
  );
}

"use client";

import { authClient, getAuthErrorMessage, useImportGoogleAvatar } from "@oc/api-client";
import { Check, Link2 } from "@oc/icons";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "@/lib/i18n";

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

const SECURITY_CALLBACK = "/dashboard/profile?tab=security";

export function ConnectedAccountsSection() {
  const { t } = useTranslation();
  const [hasGoogle, setHasGoogle] = useState<boolean | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [avatarMsg, setAvatarMsg] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const importGoogleAvatar = useImportGoogleAvatar();

  useEffect(() => {
    void authClient.listAccounts().then((result) => {
      const accounts = result.data ?? [];
      setHasGoogle(accounts.some((account) => account.providerId === "google"));
    });
  }, []);

  async function handleConnectGoogle() {
    setLinkError(null);
    const result = await authClient.linkSocial({
      provider: "google",
      callbackURL: `${window.location.origin}${SECURITY_CALLBACK}`,
    });
    if (result.error) {
      setLinkError(getAuthErrorMessage(result.error));
    }
  }

  async function handleImportGoogleAvatar() {
    setAvatarMsg(null);
    setAvatarError(null);
    try {
      await importGoogleAvatar.mutateAsync();
      setAvatarMsg(t("profile.connectedAccounts.pictureImported"));
    } catch (err: unknown) {
      setAvatarError(
        err instanceof Error ? err.message : t("profile.connectedAccounts.pictureImportFailed")
      );
    }
  }

  if (hasGoogle === null) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("profile.connectedAccounts.loadingAccounts")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {linkError ? (
        <Alert variant="destructive">
          <AlertDescription>{linkError}</AlertDescription>
        </Alert>
      ) : null}
      {avatarError ? (
        <Alert variant="destructive">
          <AlertDescription>{avatarError}</AlertDescription>
        </Alert>
      ) : null}
      {avatarMsg ? (
        <Alert className="border-success/30 bg-success/10">
          <AlertDescription>{avatarMsg}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background">
            <GoogleIcon />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("profile.connectedAccounts.google")}
            </p>
            <p className="text-xs text-muted-foreground">
              {hasGoogle
                ? t("profile.connectedAccounts.connected")
                : t("profile.connectedAccounts.connect")}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {hasGoogle ? (
            <>
              <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-medium text-success sm:self-end">
                <Check className="size-3.5" aria-hidden="true" />
                {t("profile.connectedAccounts.connectedBadge")}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                disabled={importGoogleAvatar.isPending}
                onClick={() => void handleImportGoogleAvatar()}
              >
                {importGoogleAvatar.isPending ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    {t("profile.connectedAccounts.importing")}
                  </>
                ) : (
                  t("profile.connectedAccounts.importPicture")
                )}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2 sm:w-auto"
              onClick={() => void handleConnectGoogle()}
            >
              <Link2 className="size-4" aria-hidden="true" />
              {t("profile.connectedAccounts.connectGoogle")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

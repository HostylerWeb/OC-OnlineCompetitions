"use client";

import { SocialIcon } from "@oc/icons";
import { Check, Copy, Mail } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Field, FieldDescription, FieldLabel } from "./ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "./ui/input-group";
import { Separator } from "./ui/separator";

interface ShareChannel {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  disabledTooltip?: string;
  attrs?: Record<string, string>;
}

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareConfig: {
    url: string;
    text: string;
    referralCode?: string;
  };
  title?: string;
}

function SocialShareButton({ channel }: { channel: ShareChannel }) {
  const content = (
    <>
      {channel.icon}
      <span className="text-xs font-medium">{channel.label}</span>
    </>
  );

  const className = cn(
    "flex h-auto w-full flex-col gap-2 py-3 whitespace-normal",
    channel.disabled && "opacity-50 pointer-events-none"
  );

  if (channel.href && !channel.disabled) {
    return (
      <Button variant="social" className={className} asChild>
        <a
          href={channel.href}
          target="_blank"
          rel="noopener noreferrer"
          title={channel.disabledTooltip}
          {...channel.attrs}
        >
          {content}
        </a>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="social"
      className={className}
      onClick={channel.onClick}
      disabled={channel.disabled}
      title={channel.disabledTooltip}
      {...channel.attrs}
    >
      {content}
    </Button>
  );
}

export function ShareDialog({ open, onOpenChange, shareConfig, title }: ShareDialogProps) {
  const { t } = useTranslation();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const { url, text, referralCode } = shareConfig;
  const shareUrl = (() => {
    if (!referralCode) return url;
    const origin = typeof window !== "undefined" ? window.location.origin : new URL(url).origin;
    return `${origin}/?ref=${encodeURIComponent(referralCode)}`;
  })();
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(`${text} ${shareUrl}`);

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const copyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  const socialChannels: ShareChannel[] = [
    {
      id: "telegram",
      label: t("share.telegram"),
      icon: <SocialIcon name="telegram" className="size-5" />,
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(text)}`,
      attrs: { "data-umami-event": "share:telegram-click" },
    },
    {
      id: "whatsapp",
      label: t("share.whatsApp"),
      icon: <SocialIcon name="whatsapp" className="size-5" />,
      href: `https://wa.me/?text=${encodedText}`,
      attrs: { "data-umami-event": "share:whatsapp-click" },
    },
    {
      id: "facebook",
      label: t("share.facebook"),
      icon: <SocialIcon name="facebook" className="size-5" />,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      attrs: { "data-umami-event": "share:facebook-click" },
    },
    {
      id: "instagram",
      label: t("share.instagram"),
      icon: <SocialIcon name="instagram" className="size-5" />,
      disabled: true,
      disabledTooltip: t("share.openInstagram"),
    },
    {
      id: "tiktok",
      label: t("share.tiktok"),
      icon: <SocialIcon name="tiktok" className="size-5" />,
      href: `https://www.tiktok.com/share?url=${encodedUrl}`,
    },
    {
      id: "email",
      label: t("share.email"),
      icon: <Mail />,
      href: `mailto:?subject=${encodeURIComponent(t("share.emailSubject"))}&body=${encodedText}`,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? t("share.title")}</DialogTitle>
          <DialogDescription>
            {t("share.description")}
            {referralCode ? t("share.referralCodeIncluded") : "."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {socialChannels.map((channel) => (
            <SocialShareButton key={channel.id} channel={channel} />
          ))}
        </div>

        <Field>
          <FieldLabel htmlFor="share-link">{t("share.shareLink")}</FieldLabel>
          <InputGroup className="h-10">
            <InputGroupInput
              id="share-link"
              readOnly
              value={shareUrl}
              className="text-sm"
              aria-label={t("share.shareLink")}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="button"
                size="icon-sm"
                onClick={copyLink}
                aria-label={copiedLink ? t("share.linkCopied") : t("share.copyShareLink")}
                data-umami-event="share:copy-link"
              >
                {copiedLink ? <Check /> : <Copy />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>

        {referralCode ? (
          <>
            <Separator />
            <Field>
              <FieldLabel htmlFor="referral-code">{t("share.yourReferralCode")}</FieldLabel>
              <InputGroup className="h-10">
                <InputGroupInput
                  id="referral-code"
                  readOnly
                  value={referralCode}
                  className="font-mono text-sm"
                  aria-label={t("share.referralCode")}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    size="icon-sm"
                    onClick={copyCode}
                    aria-label={copiedCode ? t("share.codeCopied") : t("share.copyReferralCode")}
                    data-umami-event="share:copy-code"
                  >
                    {copiedCode ? <Check /> : <Copy />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>{t("share.referralHint")}</FieldDescription>
            </Field>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

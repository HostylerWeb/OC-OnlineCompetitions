import { cn, SOCIAL_LINKS } from "@oc/utils";
import { SocialIcon } from "./SocialIcon";

const iconButtonBase =
  "group flex items-center justify-center border border-gold/20 bg-card/60 text-gold transition-colors hover:bg-gold hover:text-black hover:border-gold";

export function SocialLinksIconButtons({
  className,
  buttonClassName,
  iconClassName = "size-4",
  umamiEvent,
}: {
  className?: string;
  buttonClassName?: string;
  iconClassName?: string;
  umamiEvent?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {SOCIAL_LINKS.map((link) => (
        <a
          key={link.icon}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={link.label}
          title={link.label}
          className={cn(iconButtonBase, buttonClassName)}
          {...(umamiEvent ? { "data-umami-event": umamiEvent } : {})}
        >
          <SocialIcon name={link.icon} className={iconClassName} />
        </a>
      ))}
    </div>
  );
}

export function SocialLinksChips({
  className,
  umamiEvent = "contact:social-follow",
}: {
  className?: string;
  umamiEvent?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {SOCIAL_LINKS.map(({ label, href, icon }) => (
        <a
          key={icon}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          data-umami-event={umamiEvent}
          data-umami-event-social={label}
          className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-gold/20 text-xs font-medium text-muted-foreground hover:border-gold/50 hover:text-gold transition-colors"
        >
          <SocialIcon name={icon} className="size-3.5 shrink-0" />
          {label}
        </a>
      ))}
    </div>
  );
}

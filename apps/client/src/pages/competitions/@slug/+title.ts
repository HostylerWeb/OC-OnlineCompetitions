import { translate } from "@/lib/i18n";
import type { Data } from "./+data";

export default (pageContext: { data?: Data; locale?: string }): string => {
  const comp = pageContext.data?.competition;
  if (!comp?.title) return "Competition Not Found — Online Competitions";
  const locale = pageContext.locale ?? "en";
  const name = translate("head.siteName", undefined, locale);
  return `${comp.title} — ${name}`;
};

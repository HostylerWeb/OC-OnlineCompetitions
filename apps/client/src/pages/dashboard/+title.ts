import { translate } from "@/lib/i18n";

export default (pageContext: { locale?: string }): string => {
  const locale = pageContext.locale ?? "en";
  const siteName = translate("head.siteName", undefined, locale);
  return `Dashboard  -  ${siteName}`;
};

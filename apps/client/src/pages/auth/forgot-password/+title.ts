import { translate } from "@/lib/i18n";

export default (pageContext: { locale?: string }): string => {
  const locale = pageContext.locale ?? "en";
  const heading = translate("auth.forgotPassword.heading", undefined, locale);
  const siteName = translate("head.siteName", undefined, locale);
  return `${heading}  -  ${siteName}`;
};

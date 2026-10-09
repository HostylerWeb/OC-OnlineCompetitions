import type { Competition } from "@oc/types";
import { useData } from "vike-react/useData";
import { usePageContext } from "vike-react/usePageContext";
import { translate } from "@/lib/i18n";
import type { Data } from "./+data";

export function Head() {
  const pageContext = usePageContext();
  const data = useData<Data>();
  const comp = data?.competition as Partial<Competition> | null;
  const locale = (pageContext.locale as string) ?? "en";

  if (!comp) return null;

  const description =
    comp.shortDescription ||
    comp.description ||
    translate("competitions.listing.description", undefined, locale);

  return (
    <>
      <meta name="description" content={description} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: comp.title,
            description,
          }),
        }}
      />
    </>
  );
}

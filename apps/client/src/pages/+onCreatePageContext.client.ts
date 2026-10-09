import type { PageContextClient } from "vike/types";

export async function onCreatePageContext(pageContext: PageContextClient) {
  if (!pageContext.locale) {
    const match = document.cookie.match(/(?:^|;\s*)onlinecompetitions-locale=([^;]*)/);
    if (match) {
      pageContext.locale = match[1] ?? "en";
    }
  }
}

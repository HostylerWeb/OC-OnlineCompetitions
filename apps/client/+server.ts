// +server.ts — Hono entry that mounts the Hono API and Vike SSR.
//
//  1. `/api/*` (auth, cart, payments, etc.) — handled by the shared Hono app
//     from `@oc/api-server/app`.
//  2. Everything else — handled by Vike for SSR + client-side hydration.
//
// In dev, `vike dev` uses this as the server entry via Vike's `+server.ts` convention.
// In prod, build with `vike build` and run this file with bun.

process.on("unhandledRejection", (reason) => {
  if (
    reason instanceof TypeError &&
    reason.message?.includes("Invalid state: ReadableStream is locked")
  ) {
    return;
  }
  console.error("[unhandledRejection]", reason);
});

import { app as apiApp } from "@oc/api-server/app";
import { getEnv } from "@oc/env/vike";
import * as Sentry from "@sentry/node";
import vike from "@vikejs/hono";
import { Hono } from "hono";
import { resolveSentryEnvironment, resolveSentryRelease } from "@/lib/sentry-config";
import applePayDomainAssociation from "./public/apple-developer-merchantid-domain-association?raw";

const dsn = getEnv("SENTRY_DSN_WEB").trim() || "";
if (dsn) {
  Sentry.init({
    dsn,
    enabled: true,
    environment: resolveSentryEnvironment(),
    release: resolveSentryRelease(),
    autoSessionTracking: false,
    integrations: (integrations) => integrations.filter((i) => i.name !== "BunServer"),
  });
}

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));

app.get("/apple-developer-merchantid-domain-association", (c) =>
  c.newResponse(applePayDomainAssociation, 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  })
);

app.get("/sitemap.xml", async (c) => {
  const SITE_URL = getEnv("APP_URL").trim().replace(/\/$/, "") || "https://onlinecompetitions.co.uk";

  const STATIC_PAGES = [
    { loc: "/", changefreq: "daily", priority: "1.0" },
    { loc: "/competitions", changefreq: "daily", priority: "0.9" },
    { loc: "/how-it-works", changefreq: "monthly", priority: "0.5" },
    { loc: "/faq", changefreq: "monthly", priority: "0.5" },
    { loc: "/winners", changefreq: "weekly", priority: "0.6" },
    { loc: "/entries", changefreq: "daily", priority: "0.7" },
    { loc: "/about", changefreq: "monthly", priority: "0.4" },
    { loc: "/contact", changefreq: "monthly", priority: "0.3" },
    { loc: "/privacy", changefreq: "yearly", priority: "0.2" },
    { loc: "/terms", changefreq: "yearly", priority: "0.2" },
    { loc: "/cookie-policy", changefreq: "yearly", priority: "0.2" },
  ];

  let competitionUrls: string[] = [];
  try {
    const req = new Request("https://internal/api/competitions", {
      headers: { "X-Internal": "1" },
    });
    const res = await apiApp.fetch(req);
    if (res.ok) {
      const body = (await res.json()) as { data?: Array<{ slug: string; updatedAt?: string }> };
      competitionUrls = (body.data ?? []).map((comp) => {
        const slug = comp.slug
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
        const lastmod = comp.updatedAt
          ? new Date(comp.updatedAt).toISOString()
          : new Date().toISOString();
        return `  <url>\n    <loc>${SITE_URL}/competitions/${slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`;
      });
    }
  } catch {
    // Non-critical
  }

  const staticUrls = STATIC_PAGES.map(
    (p) =>
      `  <url>\n    <loc>${SITE_URL}${p.loc}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticUrls, ...competitionUrls].join("\n")}\n</urlset>`;

  return c.newResponse(xml, 200, { "Content-Type": "application/xml" });
});

app.route("/", apiApp);

app.use(async (c, next) => {
  const nonce = c.get("nonce");
  if (nonce) {
    globalThis.__onlinecompetitions_nonce = nonce;
  }
  await next();
});

const REF_CODE_PATTERN = /^[a-zA-Z0-9_-]+$/;
const REF_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

const CLICK_ID_PARAMS = ["clickid", "atclid", "subid_short"] as const;
const CLICK_ID_PATTERN = /^[a-zA-Z0-9._~@-]+$/;
const CLICK_ID_MAX_LENGTH = 255;
const CLICK_ID_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

const SOURCE_PATTERN = /^[a-z0-9]{2,4}$/;

app.use("*", async (c, next) => {
  const path = c.req.path;
  if (path === "/ro" || path.startsWith("/ro/")) {
    const rest = path === "/ro" ? "/" : path.slice(3) || "/";
    const url = new URL(c.req.url);
    return c.redirect(`/en${rest}${url.search}`, 301);
  }

  const url = new URL(c.req.url);
  const ref = url.searchParams.get("ref");
  const clickId = CLICK_ID_PARAMS.map((p) => url.searchParams.get(p)).find(
    (v) => v && v.length > 0
  );
  const source = url.searchParams.get("source");

  await next();

  const ct = c.res.headers.get("Content-Type") || "";
  if (ct.startsWith("text/html")) {
    c.res.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    if (ref && ref.length > 0 && ref.length <= 64 && REF_CODE_PATTERN.test(ref)) {
      c.res.headers.append(
        "Set-Cookie",
        `onlinecompetitions_ref=${encodeURIComponent(ref.trim().toUpperCase())}; Path=/; Max-Age=${REF_COOKIE_MAX_AGE}; SameSite=Lax`
      );
    }
    if (clickId && clickId.length <= CLICK_ID_MAX_LENGTH && CLICK_ID_PATTERN.test(clickId)) {
      c.res.headers.append(
        "Set-Cookie",
        `_aff_clickid=${encodeURIComponent(clickId)}; Path=/; Max-Age=${CLICK_ID_COOKIE_MAX_AGE}; SameSite=Lax`
      );
    }
    if (source && SOURCE_PATTERN.test(source)) {
      c.res.headers.append(
        "Set-Cookie",
        `_aff_source=${encodeURIComponent(source.toLowerCase())}; Path=/; Max-Age=${CLICK_ID_COOKIE_MAX_AGE}; SameSite=Lax`
      );
    }
  }
});

vike(app);

export default {
  port: Number(process.env.PORT) || 3555,
  fetch: app.fetch,
};

export type Server = typeof app;

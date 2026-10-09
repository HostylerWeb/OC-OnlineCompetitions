# web-lander — Competition Landing Pages (port 3333)

Next.js 16 ISR pages for competition marketing. No auth. Publicly accessible.

## Architecture

### Pages

- `app/page.tsx` — Index: active competitions, featured competition, global stats
- `app/[slug]/page.tsx` — Single competition landing page with ISR (`revalidate: 60`)

### Data fetching

`lib/api.ts` — server-only API client with ISR fetchers (`revalidate: 60`). Never called from client components.

### Styling

Tailwind CSS v4 with CSS-first configuration (`@import 'tailwindcss'`). Online Competitions brand tokens in `app/globals.css` (`--color-bg-deep`, `--color-gold`, `--color-surface`). Always dark theme.

### Animations

Custom `kino` library in `components/kino/` — `Scene`, `Reveal`, `Counter`, `Progress`, `StickyHeader`, `FrameScroll` components drive scroll-driven cinematic animations.

## Environment

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_LANDER_API_URL` | Server-side API base (default: `http://localhost:3333`). Never exposed to browser. |
| `NEXT_PUBLIC_APP_URL` | Client-side app URL for redirects (default: `http://localhost:3333`). |
| `NEXT_PUBLIC_APP_URL` | Client-side API base URL (default: `http://localhost:3333`). |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Sentry environment tag (default: `development`). |

No auth, no server-side env vars (lander has no Hono API route handler).

## Scripts

```bash
bun run dev           # port 3333
bun run build         # production build
bun run start         # production server
bun run typecheck
bun run lint
```

## Important notes

- `app/globals.css` is the **primary CSS** — contains all Online Competitions brand tokens, animations, and utility classes.
- `styles/globals.css` is legacy/inactive — not imported by the layout.
- `components/theme-provider.tsx` uses `next-themes` — allowed in this app only (forbidden in web-client/web-admin).
- `components/ui/` contains vendored shadcn components (new-york style).
- Static copy from `@oc/content` for legal/marketing text.

## Redirects

`next.config.mjs` redirects `/competitions/:slug` → `/:slug` (permanent).

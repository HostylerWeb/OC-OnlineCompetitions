# @oc/content

Static English marketing copy for the Online Competitions platform. Single source of truth for all customer-facing text. No i18n — en-GB only.

## Modules

- `home.ts` — Home page content
- `how-it-works.ts` — How it works section
- `faqs.ts` — Frequently asked questions
- `legal.ts` — Privacy policy, terms & conditions
- `responsible-play.ts` — Responsible gambling information
- `about.ts` — About page
- `contact.ts` — Contact page

## Usage

```tsx
import { homeContent } from "@oc/content";
```

Shared across `apps/admin`, `apps/client`, and `web-lander`.

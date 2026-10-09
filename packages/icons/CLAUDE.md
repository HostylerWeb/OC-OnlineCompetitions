# @oc/icons

SVG brand icons, custom status icons, and lucide-react re-exports.

## Structure

```
src/
  misc/                    — Custom brand icons
    XBrandIcon.tsx         — X (Twitter) brand logo
  status/                  — Custom status / UI icons
    CheckmarkIcon.tsx      — Checkmark
    ErrorIcon.tsx          — Error / failure X
    ExpandChevronIcon.tsx  — Expand chevron
  social/                  — Social platform SVGs
    icons.tsx              — Facebook, Instagram, Telegram, TikTok, WhatsApp
  SocialIcon.tsx           — Dispatch component (name prop → icon)
  index.ts                 — Barrel + lucide-react re-exports
  svg.d.ts                 — *.svg module declarations for TypeScript
```

## Custom icons (exported from index.ts)

| Icon | Location | Purpose |
|------|----------|---------|
| `XBrandIcon` | `misc/` | X (Twitter) brand logo |
| `SocialIcon` | `src/` | Dispatch: `name="facebook" \| "instagram" \| "telegram" \| "tiktok" \| "whatsapp"` |
| `CheckmarkIcon` | `status/` | Success state |
| `ErrorIcon` | `status/` | Error state |
| `ExpandChevronIcon` | `status/` | Expandable / collapsible indicator |

## Lucide

Most UI icons are re-exported from `lucide-react` via `index.ts`:

```tsx
import { Search, Trophy, ChevronLeft } from "@oc/icons";
```

## Usage

```tsx
<XBrandIcon className="w-6 h-6" />
<SocialIcon name="instagram" className="size-4 text-muted-foreground" />
<CheckmarkIcon className="w-4 h-4 text-green-500" />
<Search className="w-4 h-4 text-muted-foreground" />
```

Prefer importing from `@oc/icons` over direct `lucide-react` in apps for consistency.

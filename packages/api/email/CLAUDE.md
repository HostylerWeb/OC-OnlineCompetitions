# @oc/api-email

Transactional email dispatch with dual-provider strategy.

## Source of truth

`onlinecompetitions-api/packages/email/src` — synced to this repo.

## Providers

1. **Resend** — primary provider (with retry logic)
2. **Nodemailer/SMTP** — fallback (used in local dev with Mailpit)

## Features

- Sender config (from name, from email, social links) loaded from Mongoose `EmailSettings` document (cached)
- React Email templates in `src/templates/` for rendering HTML emails
- Used by referral awards, auth flows, and order confirmations

## Env vars

- `RESEND_API_KEY` — required for Resend mode (presence implies Resend is enabled)
- `SMTP_ENABLED` — set to `"true"` to enable SMTP fallback
- `SMTP_HOST` — SMTP server (default: `localhost`)
- `SMTP_PORT` — SMTP port (default: `1025` for Mailpit)
- `SMTP_USER` — SMTP auth username
- `SMTP_PASS` — SMTP auth password

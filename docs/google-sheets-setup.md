# Google Sheets — Livestream Draw Setup

## Environment Variable

Set `GOOGLE_SERVICE_ACCOUNT_KEY` in **Coolify** for the admin app:

| Key | Value | Scope |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Base64-encoded service account JSON | runtime only (`is_buildtime=false`, `is_runtime=true`) |

### How to encode locally

```bash
base64 -w0 /path/to/service-account.json
```

Paste the output into Coolify's env var field.

> The PEM private key contains newlines — using base64 avoids Dockerfile ARG parsing issues.
> Setting `is_buildtime=false` is critical for any multiline or PEM-based env var.

## Service Account

- **Email**: `onlinecompetitions-spreadsheets@project-db8b8d80-7925-41ae-818.iam.gserviceaccount.com`
- **Project**: `project-db8b8d80-7925-41ae-818`

## Google Cloud APIs to Enable

In the GCP project above, enable:

1. **Google Sheets API** — creating spreadsheets, writing entry data
2. **Google Drive API** — setting public read access + granting editor permissions to whitelisted emails

No domain-wide delegation required.

## How It Works

| Action | API Call | Behavior |
|---|---|---|
| Click "Open Spreadsheet" | `POST /api/admin/livestream/create-sheet` | Fetches current sold tickets → creates new sheet or **refreshes** existing sheet data → reconciles editor permissions → returns URL |
| Add email to whitelist | `POST /api/admin/sheet-settings` | Adds email → fire-and-forget sync to all existing sheets |
| Remove email | `DELETE /api/admin/sheet-settings/:email` | Removes email → fire-and-forget sync |
| Sync all | `POST /api/admin/sheet-settings/sync` | Reconciles editors on every existing sheet against current whitelist |

- **Sheet name**: `Online Competitions Draw - {Competition Title}`
- **Sheet tab**: `Entries`
- **Columns**: `Entry Number` | `Full Name`
- **Public access**: Anyone with the link can view (read-only)
- **Editors**: Whitelisted emails managed via the "Sheet Settings" dialog on the Draw Studio page

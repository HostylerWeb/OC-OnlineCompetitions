# Online Competitions documentation

Human-readable project docs live here. The repo root keeps only **[README.md](../README.md)** (GitHub overview) plus **AGENTS.md** / **CLAUDE.md** (Cursor/agent context — not day-to-day runbooks).

## Repository

| | |
|--|--|
| **GitHub** | https://github.com/HostylerWeb/Online Competitions |
| **Clone (SSH)** | `git clone git@github.com:HostylerWeb/Online Competitions.git` |
| **Local path (this host)** | `/var/www/onlinecompetitions/turborepo-main` |

Ops/SSH notes (servers, Hostinger): `/var/www/onlinecompetitions/ssh.txt`

## Start here

| Doc | Purpose |
|-----|---------|
| **[local-development.md](./local-development.md)** | Install, Docker, env files, ports, `bun run dev`, admin login, lander vs client, troubleshooting |
| **[audits.md](./audits.md)** | Index of all security/quality audits (admin, client, database, pass 4) |
| **[platform-audit-pass4.md](./platform-audit-pass4.md)** | Full-domain sweep: orders, payments, compliance, email, competitions, profile, shop, jobs |
| **[admin-audit.md](./admin-audit.md)** | Admin app security/quality audit (frontend + embedded API) — findings and backlog |
| **[client-audit.md](./client-audit.md)** | Web client + client-mobile audit (shared API, security, parity) |
| **[database-audit.md](./database-audit.md)** | MongoDB / data layer — security, performance, integrity, exploits |

**Client PDF (Hostyler remediation plan):** [Online Competitions_Remediation_Proposal_Hostyler.pdf](../Online Competitions_Remediation_Proposal_Hostyler.pdf) — source HTML in [proposal/Online Competitions_Remediation_Proposal.html](./proposal/Online Competitions_Remediation_Proposal.html) (regenerate with headless Chrome from that folder, same as EGC proposal workflow).

## Operations & integrations

| Doc | Purpose |
|-----|---------|
| [google-sheets-setup.md](./google-sheets-setup.md) | Google Sheets integration |
| [runbooks/paytriot-order-failed-captured.md](./runbooks/paytriot-order-failed-captured.md) | Paytriot order failure runbook |

## Environment variables

There is no single loaded `.env` at the repo root. Use:

- Root [`.env.example`](../.env.example) — combined **reference** (not loaded by apps)
- Per-app templates: `apps/admin/.env.example`, `apps/client/.env.example`, `apps/web-lander/.env.example`, `apps/shop/.env.example`

Details: [local-development.md](./local-development.md#first-time-setup).

## Package / app notes

Some folders contain **CLAUDE.md** (short context for AI tools). Those stay next to the code they describe; they are not substitutes for the guides above.

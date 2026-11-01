# Mini Invoice Approval Desk

A lightweight, self-hosted interface for reviewing invoices, comparing suspected duplicates, and recording approval decisions.

Built with **Next.js · TypeScript · PostgreSQL · Drizzle · TanStack Query · Tailwind CSS**.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/mussaddiqmahmood7/mini-invoice-approval-desk/actions/workflows/ci.yml/badge.svg)](https://github.com/mussaddiqmahmood7/mini-invoice-approval-desk/actions/workflows/ci.yml)

![Invoice review queue in dark mode, showing status totals, vendor filtering, and fictional invoices](docs/images/overview.png)

## Features

- Processing, needs-review, and completed queues with vendor filtering and invoice search.
- Invoice details, line items, dates, notes, and decision history in a slide-over panel.
- Side-by-side comparison of a suspected duplicate's number, vendor, amount, and date.
- Approvals and rejections, with a required rejection reason and transactional history writes.
- Currency-aware invoice amounts. When records use different currencies, aggregate monetary totals are omitted rather than added together.
- Light and dark themes, responsive layouts, and keyboard-accessible dialogs.
- Six fictional sample invoices across supplies, design, software, logistics, and maintenance.

![Invoice details with a suspected duplicate comparison and review actions](docs/images/invoice-detail.png)

## Quickstart

Requires **Node.js 22+**, **pnpm 12.14.0**, and PostgreSQL. Docker Compose is the easiest way to run the included local database.

```bash
git clone https://github.com/mussaddiqmahmood7/mini-invoice-approval-desk.git
cd mini-invoice-approval-desk

corepack enable
pnpm install
cp .env.example .env

docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open [localhost:3000](http://localhost:3000). The sample dataset has two processing invoices, two awaiting review (including a suspected duplicate), one approved, and one rejected.

If you already have PostgreSQL, skip Docker and set `DATABASE_URL` in `.env` before running the migration. Use the connection string and SSL settings supplied by your database provider.

```env
DATABASE_URL="postgres://postgres:postgrespassword@localhost:5433/invoice_desk"
```

These credentials are for local development. Existing installations can keep their existing `DATABASE_URL`; no schema migration is introduced by the generic branding update.

### Sample data

`pnpm db:seed` only seeds an empty invoice database. To deliberately replace **all invoices, line items, and invoice history**, run:

```bash
pnpm db:seed --reset
```

There is no browser reset endpoint. Sample history and duplicate flags are fictional examples, not results of an included OCR or duplicate-detection engine.

## API

Responses use `{ "success": true, ... }` or `{ "success": false, "error": "..." }`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/invoices` | List invoices with items, history, global statistics, and vendor names |
| `GET` | `/api/invoices/:id` | Invoice details, including the linked original invoice for comparison |
| `PATCH` | `/api/invoices/:id/status` | Approve or reject an invoice and record the decision |
| `GET` | `/api/stats` | Global invoice counts and amounts |

List filters: `tab=processing`, `needs_review`, `approved_rejected`, or `all` (default); `search` matches invoice number or vendor; `vendor` matches an exact vendor name. Statistics cover all invoices, independently of filters.

```bash
curl 'http://localhost:3000/api/invoices?tab=needs_review'

curl -X PATCH 'http://localhost:3000/api/invoices/INVOICE_UUID/status' \
  -H 'Content-Type: application/json' \
  -d '{"status":"REJECTED","note":"Duplicate submission","actor":"Accounts Payable"}'
```

`status` accepts `APPROVED` or `REJECTED`. A rejection requires a nonblank `note` (up to 2,000 characters). `actor` defaults to `Reviewer` and accepts 1–100 characters. Invalid input and repeated identical decisions return `400`; an unknown invoice returns `404`.

Decisions may be corrected by changing an approved invoice to rejected or vice versa. Each successful change records its actual previous state inside a transaction with a row lock. History is an application activity log, not a tamper-proof audit system. Reviewer names are supplied by the caller, not verified identities.

Amounts in database/API invoice records are decimal strings. Statistics include `currency`; if multiple currencies exist, `currency` and all monetary aggregates are `null`, while counts remain available. No exchange-rate conversion is performed.

## Connecting your own pipeline

This project is the review interface and database-backed API. It does **not** include invoice upload, OCR, email ingestion, n8n workflows, or automatic duplicate detection.

An external service such as n8n can write invoices into PostgreSQL using the tables defined in [`src/db/schema.ts`](src/db/schema.ts):

1. Insert an `invoices` row and its `invoice_items` in a transaction. Use a globally unique `invoice_number`, an ISO currency code, and consistent line-item and invoice totals.
2. Set the status to `PROCESSING` or `NEEDS_REVIEW`; add an initial `invoice_status_history` entry.
3. For a suspected duplicate, set `duplicate_of_id` to the original invoice UUID and optionally add `DUPLICATE_SUSPECTED` to `flags`.
4. Review through the interface. Your pipeline can read decisions from the API or database and perform downstream work.

Keep credentials in your server or workflow environment. There is no invoice-creation endpoint, webhook, or guaranteed pagination contract. For a large dataset, add pagination before relying on the list endpoint.

## Deployment

### Production container

The production image uses Next.js standalone output and is built for `linux/amd64` from the exact Node base `node:22.23.4-alpine3.24@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914`. Node 22.23.4 is an LTS security release from 2026-10-21. The multi-stage build installs the existing lockfile with pnpm 12.14.0 and copies only the traced runtime, static assets, and MIT license into the final stage.

Build and run it without a database or credentials:

```bash
docker build --pull --platform linux/amd64 -t mini-invoice-approval-desk:local .
docker run --name mini-invoice-approval-desk -p 3000:3000 mini-invoice-approval-desk:local
```

Open [localhost:3000](http://localhost:3000). The home page and `GET /api/health` work without PostgreSQL. The health endpoint reports only whether the portal process can answer HTTP; it deliberately does not query PostgreSQL, n8n, or another external service. Invoice API routes still require `DATABASE_URL` at runtime:

```bash
docker run --name mini-invoice-approval-desk -p 3000:3000 \
  -e DATABASE_URL='postgresql://user:password@database:5432/invoice_desk' \
  mini-invoice-approval-desk:local
```

Pass secrets only at runtime. The Docker build ignores `.env*`, `.git`, local dependencies, build output, tests, and development documentation. It does not run migrations or `pnpm db:seed`, and it does not include a PostgreSQL server.

The container listens on `0.0.0.0:3000`, runs as the image's non-root `node` user, and uses the exec-form `node server.js` command so `docker stop --time 10 mini-invoice-approval-desk` delivers `SIGTERM` directly to the Next.js process. Verify the built artifact with:

```bash
pnpm container:verify -- mini-invoice-approval-desk:local
```

That check starts a disposable database-free container, verifies the image platform, non-root identity, health and home routes, excluded files, and a clean stop before the timeout. It removes the test container afterward. The image is not published by this repository, and only `linux/amd64` is currently verified. Authentication remains outside this image; do not expose it publicly without the protection described below.

### Node.js process

```bash
pnpm build
pnpm start
```

Set `DATABASE_URL` on the server and run `pnpm db:migrate` against the intended database before starting the app. Use `pnpm db:generate` to generate migrations after intentional schema changes.

**Authentication is not included.** For real invoices, protect the entire application and `/api/*` routes with your organization's authenticated proxy or private access layer. An unprotected deployment allows visitors to read invoices and change decisions. Use fictional data for public demos.

## Development

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI runs these checks on pushes to `main` and pull requests. Tests cover status-payload validation, currency formatting, and monetary aggregates.

```text
src/app/api/     Invoice and statistics route handlers
src/components/ Review interface and shared UI primitives
src/db/         Schema, migrations, connection, and fictional seed data
src/hooks/      TanStack Query fetching and mutations
src/lib/        Formatting and statistics helpers
```

Small fixes and improvements are welcome. Open an issue to discuss substantial changes and include the relevant checks with a pull request.

## License and credit

Copyright © 2026 [Mussaddiq Mahmood](https://github.com/mussaddiqmahmood7). Released under the [MIT License](LICENSE).

You may use, modify, self-host, and commercially reuse this project under that license. Retain its copyright and license notice in copies or substantial portions. A link back to this repository is appreciated; a visible credit in your deployed interface is optional.

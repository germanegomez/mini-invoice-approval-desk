# Mini Invoice Approval Desk

A self-hosted, read-only interface for the current invoice processing invoice revision. It is
built with Next.js, TypeScript, PostgreSQL, TanStack Query, and Tailwind CSS.

The portal authenticates preauthorized Google Workspace users, but a valid
session does not grant invoice access. The production `InvoiceReadScope`
resolver returns `none` until ticket #61 implements approved roles, tasks, and
assignments. Approval, rejection, classification changes, and every other
invoice mutation remain disabled.

## invoice processing read contract

The runtime reads only these regular, allowlisted PostgreSQL views:

- `portal.invoices_v1`
- `portal.invoice_items_v1`

They expose the current `universal_raw_id + extraction_revision` selected by
invoice processing. The portal does not query the underlying public tables, copy invoices,
load a historical revision, expose source documents, or use the original demo
tables at runtime. Raw OCR/Docling content, LLM material, evidence, complete
JSON objects, hashes, transport identifiers, source references, URLs, and
diagnostics are absent from DTOs and responses.

Every list, filter-option, detail, and statistics query requires an explicit
server-side scope (`none`, `all`, or a set of positive `universal_raw_id`
values). Browser input cannot select or widen that scope. Details outside the
scope return the same `404` as missing or superseded records. Detail successes
and denials are audited using only the local actor ID, invoice ID, bounded
result, and request ID.

See [docs/invoice-read-model.md](docs/invoice-read-model.md) for filters, cursor,
statistics, freshness, and security boundaries.

## Development

Requires Node.js 22+ and pnpm 12.14.0. The database must already contain the
portal authentication contract through V020 and the invoice processing read model in V021
from `germanegomez/invoice-automation-workflow`.

```bash
corepack pnpm@12.14.0 install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm smoke
```

Copy `.env.example` to a local ignored environment file and provide the
server-only database and OAuth values. Never commit real identities or secrets.
The build does not need those values.

The inherited Drizzle demo migration, push, and seed commands are not part of
the invoice processing integration and must not be run against the shared database. This
application does not own portal or invoice processing schema migrations.

## API

All protected responses use `Cache-Control: private, no-store`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/invoices` | Scoped current-revision list, filter options, and indicators |
| `GET` | `/api/invoices/:universalRawId` | Scoped current-revision header and items |
| `GET` | `/api/stats` | Scoped counts and currency-separated totals |
| `PATCH` | `/api/invoices/:id/status` | Disabled until #61 |
| `GET` | `/api/health` | Public process health; deliberately database-independent |

List filters are exact `processingStage`, exact `preparationStatus`, ISO
`currency`, canonical `issueDateFrom`/`issueDateTo`, and a bounded `search`
over CUIT, legal name, point of sale, and document number. Unknown parameters,
invalid enum values, invalid dates, and malformed cursors return `400`.

Pagination is keyset-based with `updated_at DESC, universal_raw_id DESC`, 25
rows by default, and 100 maximum. The cursor is opaque, versioned, canonical,
and strictly validated. It is not an authorization token. A row updated between
requests can move because the read model intentionally has no persistent cache.

Statistics retain real invoice processing processing and preparation codes. Monetary values
are aggregated only inside each ISO currency. Null or non-canonical amounts are
counted as excluded and never coerced or combined across currencies.

## Container

The production image is built from the fixed Node 22.23.4 Alpine digest in the
Dockerfile, installs the lockfile with pnpm 12.14.0, and runs the standalone
server as the non-root `node` user. It contains no source tree, tests, local
environment file, database migration, or seed execution.

```bash
docker build --pull --platform linux/amd64 -t mini-invoice-approval-desk:local .
pnpm container:verify -- mini-invoice-approval-desk:local
```

`/api/health` and `/login` remain available without PostgreSQL. Protected
requests require the authentication database; invoice responses additionally
require a configured read scope. Building or running the image does not migrate
a database, activate invoice processing, call n8n, or deploy anything.

## Authentication

Google Workspace login is restricted to locally preauthorized users. The
encrypted session contains only the local user ID, Google subject,
`auth_version`, and original authentication time. Every protected request
revalidates the local account, so disablement and revocation take effect on the
next request. Real OAuth credentials and user emails remain outside this
repository.

## License and credit

Copyright © 2026 [Mussaddiq Mahmood](https://github.com/mussaddiqmahmood7).
Released under the [MIT License](LICENSE). Retain the copyright and license
notice in copies or substantial portions.

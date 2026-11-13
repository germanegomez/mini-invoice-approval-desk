# invoice processing portal application contract

This application consumes the V021 read model owned by
`germanegomez/invoice-automation-workflow`. The database role has `SELECT` on
the two `portal.invoice_*_v1` views and no direct read or write privilege on their
underlying invoice processing tables. Application SQL names every projected column and maps
rows into explicit camel-case DTOs.

## Authorization

`InvoiceReadScope` is mandatory in every repository function:

- `none` produces no readable rows and protected routes return `403`;
- `all` is available only to dependency-injected tests until a later policy
  explicitly authorizes it; and
- `ids` applies `universal_raw_id = ANY($n::integer[])` to every query.

The production resolver contains no environment, header, URL, cookie, or query
parameter override and returns `none`. Ticket #61 must replace only that
resolver; repository and route callers must continue to require a scope.

The detail repository first selects a scoped current header, then joins items
back to the header view using the exact `(universal_raw_id,
extraction_revision)` pair. It never accepts a revision from the client. Missing,
superseded, and out-of-scope details are deliberately indistinguishable.

## Query validation

Accepted list parameters are:

| Parameter | Validation |
| --- | --- |
| `processingStage` | Exact value from the invoice processing database constraint |
| `preparationStatus` | `extracted`, `awaiting_classification`, `classified`, or `posted` |
| `currency` | Three uppercase ASCII letters |
| `issueDateFrom`, `issueDateTo` | Real canonical `YYYY-MM-DD` dates with a non-inverted range |
| `search` | Trimmed, maximum 100 characters; SQL wildcard characters are escaped |
| `limit` | Integer 1–100, default 25 |
| `cursor` | Canonical base64url JSON, version 1, with ISO timestamp and positive integer ID |

All values are positional PostgreSQL parameters. Statuses and columns are never
interpolated from browser text. The cursor controls position only; the scope is
reapplied independently on every page.

## Responses and freshness

List and detail DTOs expose only fields present in V021's allowlist. The UI
shows integer `universal_raw_id`, current `extraction_revision`, both real invoice processing
statuses, nullable canonical fields, and currency-aware amounts. It does not
show the demo four-state model or claim a revision history.

List, detail, statistics, and filter options use `private, no-store` responses.
The client refetches manually and on window focus and displays its last query
time. Because the source is a regular view, the next query observes committed
invoice processing changes; keyset pagination does not promise a permanent snapshot.

Statistics count real states within the same scope. Decimal text is aggregated
only when it is canonical and has a canonical currency, grouped by that
currency. Invalid/null values remain excluded counts. There is no exchange-rate
conversion and no mixed-currency total.

## Audit and operational boundary

Detail success, configured-scope misses, and no-scope denials append a bounded
event to `portal.audit_events`. The event carries only local actor ID,
`universal_raw_id`, result, and a generated request ID. It contains no invoice
content, filter string, CUIT, amount, source document, OAuth material, or claim.

The status route remains disabled. This change does not run inherited demo
migrations or seeds, apply V021 to a persistent volume, change an n8n workflow,
execute or activate invoice processing, publish an image, or deploy the portal.

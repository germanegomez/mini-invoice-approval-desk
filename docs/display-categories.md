# Display categories on the approval desk

Only current revisions from `portal.invoices_v1` participate. The scoped list, category totals and tabs share the decision table in `src/lib/invoices/presentation.ts`. Apply the first matching row. All task and outcome checks match both invoice ID and extraction revision.

| Category | Canonical evidence |
| --- | --- |
| REJECTED | Processing stage `rejected`, outcome `rejected_final`, or outcome `cancelled_internal` / `exception_closed` with no open task. These last two are closures without approval. The drawer retains the exact human outcome. |
| NEEDS_REVIEW | Open task (`available`, `claimed`, `waiting_for_document`), `requires_human_review` flag or stage, or incomplete classification during the `awaiting_classification` preparation status or processing stage. Corrections return to an open task. |
| APPROVED | Outcome `ready_for_post_approval_processing`; the read view normalizes the older `ready_for_wf05_continuation` to the same value. Subsequent job status has no effect. |
| PROCESSING | Every remaining visible revision. Unclassified lines, a technical approval, a linked duplicate or an error alone do not imply a human decision. |

The remaining technical stages are `received`, `preprocessing`, `preprocessed`, `ocr_processing`, `ocr_complete`, `llm_extracting`, `llm_complete`, `validating`, `validated`, `retry_wait`, `approved`, `accounting_etl`, `processed`, `linked_duplicate`, `requires_reprocessing` and `error`. Preparation statuses `extracted`, `classified` and `posted` alone have no human meaning. Documents without a current preparation and superseded preparations are outside the read view.

The first two tabs select one category each; the last combines approved and rejected. KPI counts and per-currency amounts cover the entire authorized scope. Vendor, search, advanced filters, tab and cursor affect only list rows. A missing/invalid amount still contributes one invoice. The drawer uses the current API's explicit per-item classification and the session-derived actions. Each command rechecks permissions and revision in PostgreSQL.

export const PROCESSING_STAGES = [
  "received",
  "preprocessing",
  "preprocessed",
  "ocr_processing",
  "ocr_complete",
  "llm_extracting",
  "llm_complete",
  "validating",
  "validated",
  "retry_wait",
  "requires_human_review",
  "approved",
  "accounting_etl",
  "processed",
  "linked_duplicate",
  "rejected",
  "requires_reprocessing",
  "error",
  "awaiting_classification",
] as const;

export const PREPARATION_STATUSES = [
  "extracted",
  "awaiting_classification",
  "classified",
  "posted",
] as const;

export type ProcessingStage = (typeof PROCESSING_STAGES)[number];
export type PreparationStatus = (typeof PREPARATION_STATUSES)[number];

export const DISPLAY_CATEGORIES = ["PROCESSING", "NEEDS_REVIEW", "APPROVED", "REJECTED"] as const;
export type DisplayCategory = (typeof DISPLAY_CATEGORIES)[number];
export const INVOICE_TABS = ["processing", "needs_review", "approved_rejected"] as const;
export type TabType = (typeof INVOICE_TABS)[number];

export interface CategoryStats {
  code: DisplayCategory;
  count: number;
  currencyTotals: CurrencyTotal[];
}

export interface InvoiceSummary {
  category: DisplayCategory;
  itemCount: number;
  universalRawId: number;
  extractionRevision: number;
  processingStage: ProcessingStage;
  preparationStatus: PreparationStatus;
  requiresHumanReview: boolean;
  classificationComplete: boolean;
  createdAt: string;
  updatedAt: string;
  fileName: string;
  documentType: string | null;
  invoiceLetter: string | null;
  pointOfSale: string | null;
  documentNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string | null;
  totalAmount: string | null;
  issuerTaxId: string | null;
  issuerName: string | null;
  issuerTradeName: string | null;
  receiverTaxId: string | null;
  receiverName: string | null;
}

export interface InvoiceItem {
  universalRawId: number;
  extractionRevision: number;
  lineNumber: number;
  code: string | null;
  description: string | null;
  quantity: string | null;
  unit: string | null;
  unitPrice: string | null;
  discountPercentage: string | null;
  discountAmount: string | null;
  subtotal: string | null;
  vatCategory: string | null;
  vatRate: string | null;
  vatAmount: string | null;
  totalWithVat: string | null;
  costCenter: string | null;
  subCostCenter: string | null;
  accountingAccount: string | null;
  updatedAt: string;
}

export interface ExtractionReview {
  caseId: string;
  revision: number;
  warnings: unknown[];
  observedFields: string[];
  values: Record<string, string>;
  status: string;
  posted: boolean;
  current: boolean;
  canDecide: boolean;
  accounting?: boolean;
  documentWait?: "legible_copy" | "supplier_document" | "replacement_linked" | null;
  canLink?: boolean;
  sourceField?: string;
  canRequestSupplier?: boolean;
  proposals?: Record<string, { value: string; id: string; field: string } | null> | null;
  referral: "correction" | "regularization" | null;
}

export interface InvoiceDetail extends InvoiceSummary {
  issuerActivityStart?: string | null;
  extractionReview?: ExtractionReview | null;
  hasOriginal: boolean;
  history: InvoiceHistoryEvent[];
  allowedActions: string[];
  items: InvoiceItem[];
  task: HumanTask | null;
  humanOutcome: HumanOutcome | null;
  continuation: PostApprovalJob | null;
}

export interface InvoiceHistoryEvent {
  title: string;
  occurredAt: string;
  actor: string | null;
  reason: string | null;
  revision: number | null;
  fromStatus: string | null;
  toStatus: string | null;
  invalidated: boolean;
}

export type HumanTaskStage =
  | "sector_approval"
  | "direction_approval"
  | "accounting_classification";

export type HumanTaskStatus = "available" | "claimed" | "waiting_for_document";

export interface HumanTask {
  id: number;
  stage: HumanTaskStage;
  queueRole: string;
  assigneeUserId: string | null;
  status: HumanTaskStatus;
  outcome: string | null;
  updatedAt: string;
}

export interface HumanOutcome {
  id: number;
  outcome: "ready_for_post_approval_processing" | "rejected_final" | "cancelled_internal" | "exception_closed";
  sourceTaskId: number;
  createdAt: string;
}

export type PostApprovalJobStatus =
  | "pending" | "claimed" | "running" | "retryable"
  | "completed" | "failed" | "superseded";

export interface PostApprovalJob {
  id: string;
  contractVersion: number;
  status: PostApprovalJobStatus;
  attempts: number;
  result: Record<string, unknown> | null;
  errorCode: string | null;
  errorDetail: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface InvoiceFilters {
  tab?: TabType;
  vendor?: string;
  processingStage?: ProcessingStage;
  preparationStatus?: PreparationStatus;
  currency?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
  search?: string;
  cursor?: string;
  limit: number;
}

export interface FilterOptions {
  vendors: string[];
  processingStages: ProcessingStage[];
  preparationStatuses: PreparationStatus[];
  currencies: string[];
}

export interface StageCount {
  code: string;
  count: number;
}

export interface CurrencyTotal {
  currency: string | null;
  amount: string | null;
  includedCount: number;
  excludedCount: number;
}

export interface InvoiceStats {
  categories: CategoryStats[];
  totalCount: number;
  processingStages: StageCount[];
  preparationStatuses: StageCount[];
  currencyTotals: CurrencyTotal[];
}

export interface InvoiceListResponse {
  success: true;
  data: InvoiceSummary[];
  nextCursor: string | null;
  filterOptions: FilterOptions;
  stats: InvoiceStats;
  lastUpdatedAt: string;
}

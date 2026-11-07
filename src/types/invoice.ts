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

export interface InvoiceSummary {
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

export interface InvoiceDetail extends InvoiceSummary {
  items: InvoiceItem[];
}

export interface InvoiceFilters {
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

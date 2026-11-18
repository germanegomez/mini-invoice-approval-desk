"use client";

import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ClassificationEditor, type DraftHandle } from "./ClassificationEditor";
import { secondaryButton } from "./BulkClassification";
import type { InvoiceDetail } from "@/types/invoice";
import { currencyLabel, formatCurrency, formatDate, formatDateTime, formatItemQuantity } from "@/lib/utils";
import { StatusBadge, DuplicateBadge } from "./StatusBadge";
import { TaskActionPanel } from "./TaskActionPanel";
import { InvoiceHistoryTimeline } from "./InvoiceHistoryTimeline";
import { InvoiceTotal } from "./InvoiceTotal";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "./ui/sheet";
import { FileText, X } from "lucide-react";

function withoutTestPrefix(value: string | null) {
  return value?.replace(/^SYNTHETIC · /, "") ?? null;
}

export function InvoiceDetailDrawer({ invoice: source, open, onOpenChange, isLoading, onChanged, onDirtyChange }: {
  invoice: InvoiceDetail | null;
  open: boolean;
  onOpenChange(open: boolean): void;
  isLoading: boolean;
  onDirtyChange(dirty: boolean): void;
  onChanged(): Promise<void> | void;
}) {
  const editor = useRef<DraftHandle>(null);
  const [nextAction, setNextAction] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);
  // The review generator reserves this filename pattern and an all-zero recipient CUIT.
  const isTest = source?.receiverTaxId === "00000000000" && /^TEST-SYNTHETIC-[1-9]\d*\.pdf$/.test(source.fileName);
  const invoice = isTest ? {
    ...source,
    issuerName: withoutTestPrefix(source.issuerName),
    items: source.items.map(item => ({ ...item, description: withoutTestPrefix(item.description) })),
  } : source;
  function guard(action: () => void) {
    if (editor.current?.busy) return;
    if (editor.current?.dirty) setNextAction(() => action);
    else action();
  }
  const onClose = () => guard(() => onOpenChange(false));
  const accounting = invoice?.task?.stage === "accounting_classification";
  const canEdit = accounting && invoice.allowedActions.some(action => action === "classification.save" || action === "classification.complete");
  const taskPanel = invoice && <TaskActionPanel key={invoice.task?.id ?? "none"} invoice={invoice} guard={guard} onChanged={onChanged} />;
  const money = (value: string | null) => invoice?.currency ? formatCurrency(value, invoice.currency) : "—";

  return (
      <Sheet open={open} onOpenChange={value => { if (!value) onClose(); }}>
        <SheetContent
          onEscapeKeyDown={event => {
            if (document.activeElement?.matches('input[role="combobox"][aria-expanded="true"]')) event.preventDefault();
          }}
          side="right"
          className="top-0 right-0 h-[100dvh] max-h-[100dvh] w-full sm:max-w-xl md:max-w-2xl bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col p-0 overflow-hidden"
        >
          <SheetDescription className="sr-only">Review current invoice details and available actions.</SheetDescription>
          {/* Fixed Drawer Header (shrink-0) */}
          <header className="border-b border-zinc-200 dark:border-zinc-800 px-3.5 sm:px-6 py-3 sm:py-4 bg-zinc-50 dark:bg-zinc-900/95 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="p-1.5 sm:p-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-amber-500 border border-zinc-300 dark:border-zinc-700 shrink-0">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <SheetTitle className="text-sm sm:text-lg font-bold font-mono tracking-tight text-zinc-900 dark:text-white truncate">
                    {[invoice?.pointOfSale, invoice?.documentNumber].filter(Boolean).join("-") || "Invoice details"}
                  </SheetTitle>
                  {invoice && <StatusBadge status={invoice.category} size="sm" />}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="min-w-0 break-words font-medium text-zinc-700 dark:text-zinc-300">{invoice?.issuerName ?? "—"}</span>
                  {isTest && <span className="rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:border-zinc-600 dark:text-zinc-300">Factura de prueba</span>}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors shrink-0"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </header>

          {!invoice && <p role="status" className="p-4 text-sm text-zinc-500">{isLoading ? "Loading invoice details..." : "Unable to load invoice details."}</p>}
          {invoice && <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3.5 sm:px-6 py-3.5 sm:py-6 space-y-4 sm:space-y-6">
            {invoice.processingStage === "linked_duplicate" && <DuplicateBadge />}
            {/* Vendor & General Metadata Grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 p-3 sm:p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-xs">
              <div>
                <span className="text-[10px] sm:text-[11px] font-mono uppercase text-zinc-500">Tax Registration</span>
                <p className="text-xs font-mono text-zinc-800 dark:text-zinc-300 mt-0.5">
                  {invoice.issuerTaxId || "—"}
                </p>
              </div>
              <div>
                <span className="text-[10px] sm:text-[11px] font-mono uppercase text-zinc-500">Currency</span>
                <p className="mt-0.5 font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-300">{currencyLabel(invoice.currency)}</p>
              </div>

              <div className="border-t border-zinc-200 dark:border-zinc-800/80 pt-2 sm:pt-3">
                <span className="text-[10px] sm:text-[11px] font-mono uppercase text-zinc-500">Issue Date</span>
                <p className="text-xs font-mono text-zinc-800 dark:text-zinc-300 mt-0.5">{formatDate(invoice.issueDate)}</p>
              </div>

              <div className="border-t border-zinc-200 dark:border-zinc-800/80 pt-2 sm:pt-3">
                <span className="text-[10px] sm:text-[11px] font-mono uppercase text-zinc-500">Due Date</span>
                <p className="text-xs font-mono text-zinc-800 dark:text-zinc-300 mt-0.5">{formatDate(invoice.dueDate)}</p>
              </div>
            </div>

            {accounting && taskPanel}
            {canEdit ? <ClassificationEditor key={[invoice.universalRawId, invoice.extractionRevision, invoice.task?.id].join("-")}
              ref={editor} invoice={invoice} onChanged={onChanged} onDirtyChange={onDirtyChange} /> : <div className="space-y-2 sm:space-y-3">
              <h3 className="text-[11px] sm:text-xs font-mono uppercase tracking-wider font-bold text-zinc-500 dark:text-zinc-400">
                Itemized Line Items ({invoice.items?.length || 0})
              </h3>

              <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
                <div className="overflow-x-auto w-full">
                  <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-[11px] sm:text-xs">
                    <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 font-mono text-[10px] uppercase">
                      <tr>
                        <th className="py-2 pl-3 pr-2 text-left">Description</th>
                        <th className="px-2 py-2 text-right">Qty</th>
                        <th className="py-2 pl-2 pr-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-mono">
                      {invoice.items && invoice.items.length > 0 ? (
                        invoice.items.map((item) => (
                          <tr key={item.lineNumber} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                            <td className="py-2 pl-3 pr-2 text-zinc-800 dark:text-zinc-200 font-sans text-[11px] sm:text-xs">
                              {item.description ?? "—"}
                              <small className="block text-zinc-500">{["Línea " + item.lineNumber, item.code].filter(Boolean).join(" · ")}</small>
                              <small className="block text-zinc-500">{[item.costCenter,item.subCostCenter,item.accountingAccount].filter(Boolean).join(" · ")}</small>
                            </td>
                            <td className="px-2 py-2 text-right text-zinc-600 dark:text-zinc-400 tabular-nums">
                              {formatItemQuantity(item.quantity, item.unit)}
                            </td>
                            <td className="py-2 pl-2 pr-3 text-right text-zinc-900 dark:text-zinc-100 font-bold tabular-nums">
                              {money(item.totalWithVat ?? item.subtotal)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-zinc-500">
                            No itemized lines recorded
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <InvoiceTotal>{money(invoice.totalAmount)}</InvoiceTotal>
              </div>
            </div>}
            {!accounting && taskPanel}
            <InvoiceHistoryTimeline events={invoice.history} currentRevision={invoice.extractionRevision} />
            <details className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 text-xs font-mono">
              <summary className="cursor-pointer">Detalle técnico</summary>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 break-words">
                <dt>ID / revisión</dt><dd>{invoice.universalRawId} / {invoice.extractionRevision}</dd>
                <dt>Archivo</dt><dd>{invoice.fileName}</dd>
                <dt>Comprobante</dt><dd>{[invoice.documentType, invoice.invoiceLetter].filter(Boolean).join(" ") || "—"}</dd>
                <dt>Receptor</dt><dd>{[invoice.receiverName, invoice.receiverTaxId].filter(Boolean).join(" · ") || "—"}</dd>
                <dt>Procesamiento</dt><dd>{invoice.processingStage}</dd>
                <dt>Preparación</dt><dd>{invoice.preparationStatus}</dd>
                {invoice.humanOutcome && <><dt>Código de cierre</dt><dd>{invoice.humanOutcome.outcome}</dd></>}
                <dt>Clasificación completa</dt><dd>{invoice.classificationComplete ? "Sí" : "No"}</dd>
                <dt>Actualizado</dt><dd>{formatDateTime(invoice.updatedAt)}</dd>
              </dl>
            </details>
          </div>}
          <Dialog.Root open={nextAction !== null} onOpenChange={value => { if (!value && !saving) setNextAction(null); }}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/50" />
              <Dialog.Content className="fixed left-1/2 top-1/2 z-[61] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 space-y-3 rounded-xl border border-zinc-300 bg-white p-4 text-zinc-900 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
                <Dialog.Title className="font-bold">Cambios sin guardar</Dialog.Title>
                <Dialog.Description className="text-sm">Podés guardar la clasificación en borrador antes de continuar.</Dialog.Description>
                <div className="flex flex-wrap gap-2">
                  <button className={secondaryButton} disabled={saving} onClick={() => setNextAction(null)}>Seguir editando</button>
                  {invoice?.allowedActions.includes("classification.save") && <button className={secondaryButton} disabled={saving} onClick={async () => {
                    setSaving(true);
                    const saved = await editor.current?.save();
                    setSaving(false); setNextAction(null); if (saved) nextAction?.();
                  }}>Guardar y continuar</button>}
                  <button className={secondaryButton} disabled={saving} onClick={() => {
                    editor.current?.discard(); setNextAction(null); nextAction?.();
                  }}>Descartar y continuar</button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </SheetContent>
      </Sheet>
  );
}

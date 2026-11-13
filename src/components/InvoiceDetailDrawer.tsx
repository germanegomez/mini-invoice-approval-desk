"use client";

import type { InvoiceDetail } from "@/types/invoice";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { TaskActionPanel } from "./TaskActionPanel";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";

const display = (value: string | null | undefined) => value || "—";

export function InvoiceDetailDrawer({ invoice, open, onOpenChange, isLoading, onChanged }: {
  invoice: InvoiceDetail | null;
  open: boolean;
  onOpenChange(open: boolean): void;
  isLoading: boolean;
  onChanged(): Promise<void> | void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="border-b border-zinc-200 p-5 dark:border-zinc-800">
          <SheetTitle>Detalle de factura {invoice ? `#${invoice.universalRawId}` : ""}</SheetTitle>
          <SheetDescription>Lectura de la revisión vigente. No se expone historial ni documento fuente.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {isLoading && <p className="text-sm text-zinc-500">Cargando detalle…</p>}
          {invoice && <>
            <div className="flex flex-wrap gap-2"><StatusBadge status={invoice.processingStage} /><StatusBadge status={invoice.preparationStatus} /></div>
            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
              <div><dt className="text-xs text-zinc-500">Identidad</dt><dd className="font-mono">{invoice.universalRawId} / rev. {invoice.extractionRevision}</dd></div>
              <div><dt className="text-xs text-zinc-500">Comprobante</dt><dd>{display(invoice.documentType)} {display(invoice.invoiceLetter)}</dd></div>
              <div><dt className="text-xs text-zinc-500">Punto / número</dt><dd className="font-mono">{display(invoice.pointOfSale)} / {display(invoice.documentNumber)}</dd></div>
              <div><dt className="text-xs text-zinc-500">Archivo</dt><dd className="break-all">{invoice.fileName}</dd></div>
              <div><dt className="text-xs text-zinc-500">Emisor</dt><dd>{display(invoice.issuerName)}<br/><span className="font-mono text-xs">{display(invoice.issuerTaxId)}</span></dd></div>
              <div><dt className="text-xs text-zinc-500">Receptor</dt><dd>{display(invoice.receiverName)}<br/><span className="font-mono text-xs">{display(invoice.receiverTaxId)}</span></dd></div>
              <div><dt className="text-xs text-zinc-500">Fechas</dt><dd>{formatDate(invoice.issueDate)} / {formatDate(invoice.dueDate)}</dd></div>
              <div><dt className="text-xs text-zinc-500">Total</dt><dd className="font-mono font-bold">{invoice.currency ? formatCurrency(invoice.totalAmount, invoice.currency) : "—"}</dd></div>
              <div><dt className="text-xs text-zinc-500">Clasificación</dt><dd>{invoice.classificationComplete ? "Completa" : "Pendiente"}</dd></div>
              <div><dt className="text-xs text-zinc-500">Actualizado</dt><dd>{formatDateTime(invoice.updatedAt)}</dd></div>
            </dl>
            <TaskActionPanel invoice={invoice} key={`${invoice.universalRawId}-${invoice.extractionRevision}-${invoice.task?.updatedAt ?? "no-task"}`} onChanged={onChanged} />
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">Ítems de la revisión vigente</h3>
              <div className="space-y-2">{invoice.items.length === 0 ? <p className="text-sm text-zinc-500">Sin ítems visibles.</p> : invoice.items.map((item) => (
                <article className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800" key={`${item.extractionRevision}-${item.lineNumber}`}>
                  <div className="flex justify-between gap-3"><strong>{item.lineNumber}. {display(item.description)}</strong><span className="font-mono">{invoice.currency ? formatCurrency(item.totalWithVat ?? item.subtotal, invoice.currency) : "—"}</span></div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-500">
                    <span>Cantidad: {display(item.quantity)} {display(item.unit)}</span><span>Unitario: {display(item.unitPrice)}</span>
                    <span>IVA: {display(item.vatCategory)} {display(item.vatRate)}</span><span>Cuenta: {display(item.accountingAccount)}</span>
                    <span>Centro: {display(item.costCenter)}</span><span>Subcentro: {display(item.subCostCenter)}</span>
                  </div>
                </article>
              ))}</div>
            </section>
          </>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

import type { InvoiceSummary } from "@/types/invoice";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DuplicateBadge, StatusBadge } from "./StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

function naturalKey(invoice: InvoiceSummary): string {
  const parts = [invoice.pointOfSale, invoice.documentNumber].filter(Boolean);
  return parts.length ? parts.join("-") : `WF05-${invoice.universalRawId}`;
}

export function InvoiceTable({ invoices, selectedInvoiceId, onSelectInvoice, isLoading }: {
  invoices: InvoiceSummary[];
  selectedInvoiceId: number | null;
  onSelectInvoice(invoice: InvoiceSummary): void;
  isLoading: boolean;
}) {
  if (isLoading) return <div className="rounded-xl border p-10 text-center text-sm text-zinc-500">Cargando facturas…</div>;
  if (invoices.length === 0) return <div className="rounded-xl border p-10 text-center text-sm text-zinc-500">No hay facturas para el alcance y filtros actuales.</div>;
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Factura</TableHead><TableHead>Emisor</TableHead><TableHead>Emisión</TableHead><TableHead className="text-right">Importe</TableHead><TableHead>Estados reales</TableHead>
        </TableRow></TableHeader>
        <TableBody>{invoices.map((invoice) => (
          <TableRow className={selectedInvoiceId === invoice.universalRawId ? "bg-amber-500/10" : "cursor-pointer"} key={invoice.universalRawId} onClick={() => onSelectInvoice(invoice)}>
            <TableCell><div className="font-mono font-bold">{naturalKey(invoice)}</div><div className="text-[11px] text-zinc-500">ID {invoice.universalRawId} · rev. {invoice.extractionRevision}</div></TableCell>
            <TableCell><div>{invoice.issuerName ?? "Sin razón social"}</div><div className="text-[11px] font-mono text-zinc-500">{invoice.issuerTaxId ?? "Sin CUIT"}</div></TableCell>
            <TableCell>{formatDate(invoice.issueDate)}</TableCell>
            <TableCell className="text-right font-mono font-bold">{invoice.currency ? formatCurrency(invoice.totalAmount, invoice.currency) : "—"}</TableCell>
            <TableCell><div className="flex flex-wrap gap-1"><StatusBadge size="sm" status={invoice.processingStage} /><StatusBadge size="sm" status={invoice.preparationStatus} />{invoice.processingStage === "linked_duplicate" && <DuplicateBadge />}</div></TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
    </div>
  );
}

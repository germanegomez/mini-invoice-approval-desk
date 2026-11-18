import { ArrowRight, History } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { InvoiceHistoryEvent } from "@/types/invoice";

export function InvoiceHistoryTimeline({ events, currentRevision }: {
  events: InvoiceHistoryEvent[];
  currentRevision: number;
}) {
  return (
    <section aria-labelledby="invoice-history-heading" className="space-y-2 sm:space-y-3">
      <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
        <History aria-hidden="true" className="h-3.5 w-3.5" />
        <h3 id="invoice-history-heading" className="font-mono text-[11px] font-bold uppercase tracking-wider sm:text-xs">
          Audit History Timeline
        </h3>
      </div>
      {events.length === 0 ? (
        <p className="pl-5 text-xs italic text-zinc-500 dark:text-zinc-400">Sin eventos de auditoría visibles para esta factura.</p>
      ) : (
        <ol className="relative space-y-2.5 pl-5 before:absolute before:bottom-2 before:left-[3px] before:top-2 before:w-0.5 before:bg-zinc-200 sm:space-y-3 sm:pl-6 dark:before:bg-zinc-800">
          {events.map((event, index) => (
            <li key={`${event.occurredAt}-${index}`} className="relative">
              <span aria-hidden="true" className="absolute -left-5 top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-4 ring-white sm:-left-6 dark:ring-zinc-950" />
              <div className="space-y-1 rounded-lg border border-zinc-200 bg-zinc-50 p-2 [overflow-wrap:anywhere] sm:p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                  <span className="text-[11px] font-mono font-bold text-zinc-900 sm:text-xs dark:text-zinc-100">{event.title}</span>
                  <time dateTime={event.occurredAt} className="font-mono text-[10px] text-zinc-600 dark:text-zinc-400">
                    {formatDateTime(event.occurredAt)}
                  </time>
                </div>
                {event.toStatus && (
                  <p className="flex flex-wrap items-center gap-1 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                    {event.fromStatus && <>{event.fromStatus}<ArrowRight aria-label="a" className="h-2.5 w-2.5" /></>}
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{event.toStatus}</span>
                  </p>
                )}
                {event.actor && <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  <span className="font-mono">Actor: </span><span className="font-medium text-zinc-800 dark:text-zinc-300">{event.actor}</span>
                </p>}
                {event.revision !== null && event.revision !== currentRevision && (
                  <p className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">Revisión {event.revision}</p>
                )}
                {event.invalidated && <p className="text-[11px] text-amber-800 dark:text-amber-400">Invalidada por una corrección posterior</p>}
                {event.reason && <p className="whitespace-pre-wrap border-t border-zinc-200 pt-1 text-[11px] italic text-zinc-700 dark:border-zinc-800/60 dark:text-zinc-300">“{event.reason}”</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

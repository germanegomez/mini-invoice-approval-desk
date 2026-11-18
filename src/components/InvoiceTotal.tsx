export function InvoiceTotal({ children }: { children: string }) {
  return (
    <dl className="rounded-b-xl bg-zinc-50 p-3 sm:p-4 dark:bg-zinc-950/70">
      <div className="flex items-baseline justify-between gap-3 border-t border-zinc-200 pt-1.5 font-mono text-xs font-bold text-amber-700 sm:text-sm dark:border-zinc-800 dark:text-amber-400">
        <dt>Total:</dt>
        <dd className="text-right tabular-nums">{children}</dd>
      </div>
    </dl>
  );
}

import { metricLabel, metricValue } from "./deskStyles";
import React from "react";
import type { CategoryStats, DisplayCategory } from "@/types/invoice";
import { currencyLabel, formatCurrency } from "@/lib/utils";
import { Clock, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface KPIBarProps {
  stats: CategoryStats[];
}

export function KPIBar({ stats }: KPIBarProps) {
  const cards = [
    {
      title: "Processing",
      code: "PROCESSING" as DisplayCategory,
      icon: Clock,
      borderColor: "border-sky-500/20 dark:border-sky-500/20",
      accentBg: "bg-sky-500/10",
      textColor: "text-sky-600 dark:text-sky-400",
      subtext: "Awaiting review or processing",
    },
    {
      title: "Needs Review",
      code: "NEEDS_REVIEW" as DisplayCategory,
      icon: AlertTriangle,
      borderColor: "border-amber-500/30 dark:border-amber-500/30",
      accentBg: "bg-amber-500/10",
      textColor: "text-amber-600 dark:text-amber-400",
      subtext: "Includes flagged duplicates",
      pulse: true,
    },
    {
      title: "Approved",
      code: "APPROVED" as DisplayCategory,
      icon: CheckCircle,
      borderColor: "border-emerald-500/20 dark:border-emerald-500/20",
      accentBg: "bg-emerald-500/10",
      textColor: "text-emerald-600 dark:text-emerald-400",
      subtext: "Ready for payment",
    },
    {
      title: "Rejected",
      code: "REJECTED" as DisplayCategory,
      icon: XCircle,
      borderColor: "border-rose-500/20 dark:border-rose-500/20",
      accentBg: "bg-rose-500/10",
      textColor: "text-rose-600 dark:text-rose-400",
      subtext: "Declined with audit reasoning",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 w-full">
      {cards.map((card) => {
        const Icon = card.icon;
        const group = stats.find(entry => entry.code === card.code);
        const count = group?.count ?? 0;
        const totals = (group?.currencyTotals ?? [])
          .filter(total => currencyLabel(total.currency) !== "—")
          .sort((a, b) => currencyRank(a.currency) - currencyRank(b.currency));
        return (
          <div
            key={card.title}
            className={`relative overflow-hidden rounded-xl bg-white dark:bg-zinc-900/80 border ${card.borderColor} p-2.5 sm:p-4 transition-all duration-200 hover:border-zinc-400 dark:hover:border-zinc-700 shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <span className={`${metricLabel} truncate pr-1`}>
                {card.title}
              </span>
              <div className={`p-1 sm:p-1.5 rounded-lg ${card.accentBg} ${card.textColor} shrink-0`}>
                <Icon className={`w-3 h-3 sm:w-4 sm:h-4 ${card.pulse && count > 0 ? "animate-pulse" : ""}`} />
              </div>
            </div>

            <div className="mt-1.5 sm:mt-3 flex flex-col sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between gap-1">
              <div className={`min-w-0 max-w-full space-y-0.5 break-words ${metricValue}`}>
                {totals.length ? totals.map(total => {
                  const subtotal = formatCurrency(total.amount, total.currency);
                  return <div key={total.currency}>{subtotal === "—" ? `${currencyLabel(total.currency)} —` : subtotal}</div>;
                }) : count === 0 ? formatCurrency(0, "ARS") : "—"}
              </div>
              <div className="self-start sm:self-auto inline-flex items-center px-1.5 py-0.5 rounded text-[9px] sm:text-xs font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 whitespace-nowrap">
                {count} {count === 1 ? "inv" : "invs"}
              </div>
            </div>

            <p className="mt-1 sm:mt-2 text-[9px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 font-sans truncate">
              {card.subtext}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function currencyRank(currency: string | null): number {
  if (currency === "ARS") return 0;
  if (currency === "USD") return 1;
  return 2;
}

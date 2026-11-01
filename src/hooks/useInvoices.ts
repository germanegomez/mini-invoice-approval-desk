"use client";

import { useQuery } from "@tanstack/react-query";
import type { InvoiceWithRelations, KPIStats, TabType } from "@/types/invoice";

interface InvoicesResponse {
  success: boolean;
  data: InvoiceWithRelations[];
  stats: KPIStats;
  vendors: string[];
  error?: string;
}

export function useInvoicesQuery(
  tab: TabType,
  search: string,
  vendor: string
) {
  return useQuery<InvoicesResponse>({
    queryKey: ["invoices", { tab, search, vendor }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tab) params.set("tab", tab);
      if (search) params.set("search", search);
      if (vendor && vendor !== "ALL") params.set("vendor", vendor);

      const res = await fetch(`/api/invoices?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load invoices");
      }
      return res.json();
    },
  });
}

export function useInvoiceDetailQuery(id: string | null | undefined) {
  return useQuery<{ success: boolean; data: InvoiceWithRelations; error?: string }>({
    queryKey: ["invoice", id],
    queryFn: async () => {
      if (!id) throw new Error("No ID provided");
      const res = await fetch(`/api/invoices/${id}`);
      if (!res.ok) throw new Error("Failed to load invoice details");
      return res.json();
    },
    enabled: Boolean(id),
  });
}

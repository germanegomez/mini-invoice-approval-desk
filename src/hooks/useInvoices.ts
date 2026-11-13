"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  InvoiceDetail,
  InvoiceListResponse,
  PreparationStatus,
  ProcessingStage,
} from "@/types/invoice";

export interface InvoiceQueryFilters {
  processingStage?: ProcessingStage;
  preparationStatus?: PreparationStatus;
  currency?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
  search?: string;
  cursor?: string;
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error || "Invoice data is unavailable");
    Object.assign(error, { status: response.status });
    throw error;
  }
  return body as T;
}

export function useInvoicesQuery(filters: InvoiceQueryFilters) {
  return useQuery<InvoiceListResponse>({
    queryKey: ["invoices", filters],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "25" });
      for (const [name, value] of Object.entries(filters)) {
        if (value) params.set(name, value);
      }
      return readJson<InvoiceListResponse>(
        await fetch(`/api/invoices?${params}`, { cache: "no-store" }),
      );
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: false,
  });
}

export function useInvoiceDetailQuery(id: number | null) {
  return useQuery<{ success: true; data: InvoiceDetail }>({
    queryKey: ["invoice", id],
    queryFn: async () =>
      readJson(await fetch(`/api/invoices/${id}`, { cache: "no-store" })),
    enabled: id !== null,
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: false,
  });
}

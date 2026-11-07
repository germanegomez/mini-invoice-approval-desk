import { NextResponse } from "next/server";
import { z } from "zod";
import type { AuthenticatedPortalUser } from "@/lib/auth/guard";
import type {
  FilterOptions,
  InvoiceDetail,
  InvoiceFilters,
  InvoiceStats,
} from "@/types/invoice";
import type { InvoicePage, InvoiceReadAuditResult } from "./repository";
import type { InvoiceReadScope } from "./scope";
import { InvoiceScopeError, requireConfiguredInvoiceScope } from "./scope";
import { parseInvoiceFilters, parseUniversalRawId } from "./validation";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

function privateJson(body: unknown, status = 200, requestId?: string): NextResponse {
  const headers = new Headers(PRIVATE_HEADERS);
  if (requestId) headers.set("X-Request-Id", requestId);
  return NextResponse.json(body, { status, headers });
}

function knownStatus(error: unknown): 400 | 401 | 403 | 503 | null {
  if (error instanceof z.ZodError || error instanceof InvoiceScopeError) {
    return error instanceof z.ZodError ? 400 : 403;
  }
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = Number(error.status);
    if (status === 401 || status === 403 || status === 503) return status;
  }
  return null;
}

function errorMessage(status: number): string {
  if (status === 400) return "Invalid request";
  if (status === 401) return "Authentication required";
  if (status === 403) return "Invoice access is not configured";
  if (status === 503) return "Authentication is unavailable";
  return "Invoice data is unavailable";
}

export interface InvoiceControllerDependencies {
  authenticate(): Promise<AuthenticatedPortalUser>;
  resolveScope(user: AuthenticatedPortalUser): Promise<InvoiceReadScope>;
  list(scope: InvoiceReadScope, filters: InvoiceFilters): Promise<InvoicePage>;
  detail(scope: InvoiceReadScope, universalRawId: number): Promise<InvoiceDetail | null>;
  filterOptions(scope: InvoiceReadScope): Promise<FilterOptions>;
  stats(scope: InvoiceReadScope): Promise<InvoiceStats>;
  audit(
    actorUserId: string,
    universalRawId: number,
    result: InvoiceReadAuditResult,
    requestId: string,
  ): Promise<void>;
  createRequestId(): string;
  now(): Date;
}

export async function handleInvoiceList(
  request: Request,
  dependencies: InvoiceControllerDependencies,
): Promise<NextResponse> {
  try {
    const user = await dependencies.authenticate();
    const scope = requireConfiguredInvoiceScope(await dependencies.resolveScope(user));
    const filters = parseInvoiceFilters(new URL(request.url).searchParams);
    const [page, filterOptions, stats] = await Promise.all([
      dependencies.list(scope, filters),
      dependencies.filterOptions(scope),
      dependencies.stats(scope),
    ]);
    return privateJson({
      success: true,
      data: page.data,
      nextCursor: page.nextCursor,
      filterOptions,
      stats,
      lastUpdatedAt: dependencies.now().toISOString(),
    });
  } catch (error) {
    const status = knownStatus(error);
    return privateJson(
      { success: false, error: errorMessage(status ?? 500), data: [] },
      status ?? 500,
    );
  }
}

export async function handleInvoiceDetail(
  id: string,
  dependencies: InvoiceControllerDependencies,
): Promise<NextResponse> {
  const requestId = dependencies.createRequestId();
  let user: AuthenticatedPortalUser | null = null;
  let universalRawId: number | null = null;
  try {
    user = await dependencies.authenticate();
    universalRawId = parseUniversalRawId(id);
    const resolvedScope = await dependencies.resolveScope(user);
    if (resolvedScope.kind === "none") {
      await dependencies.audit(user.id, universalRawId, "denied", requestId);
      throw new InvoiceScopeError();
    }
    const invoice = await dependencies.detail(resolvedScope, universalRawId);
    if (!invoice) {
      await dependencies.audit(user.id, universalRawId, "not_found_or_out_of_scope", requestId);
      return privateJson({ success: false, error: "Invoice not found" }, 404, requestId);
    }
    await dependencies.audit(user.id, universalRawId, "success", requestId);
    return privateJson({ success: true, data: invoice }, 200, requestId);
  } catch (error) {
    const status = knownStatus(error);
    return privateJson(
      { success: false, error: errorMessage(status ?? 500) },
      status ?? 500,
      requestId,
    );
  }
}

export async function handleInvoiceStats(
  dependencies: InvoiceControllerDependencies,
): Promise<NextResponse> {
  try {
    const user = await dependencies.authenticate();
    const scope = requireConfiguredInvoiceScope(await dependencies.resolveScope(user));
    return privateJson({ success: true, stats: await dependencies.stats(scope) });
  } catch (error) {
    const status = knownStatus(error);
    return privateJson(
      { success: false, error: errorMessage(status ?? 500) },
      status ?? 500,
    );
  }
}

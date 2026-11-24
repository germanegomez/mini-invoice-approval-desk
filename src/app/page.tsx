import { redirect } from "next/navigation";
import { ApprovalDeskClient } from "@/components/ApprovalDeskClient";
import { AuthAccessError, requireAuthenticatedUser } from "@/lib/auth/guard";
import { resolveInvoiceReadScope } from "@/lib/invoices/scope-resolver";
import { requireConfiguredInvoiceScope } from "@/lib/invoices/scope";
import { canReadWeeklyReport } from "@/lib/reports/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ApprovalDeskPage({ searchParams }: { searchParams: Promise<{ invoice?: string }> }) {
  let weeklyReport = false;
  try {
    const user = await requireAuthenticatedUser();
    requireConfiguredInvoiceScope(await resolveInvoiceReadScope(user));
    weeklyReport = await canReadWeeklyReport(user.id);
  } catch (error) {
    if (!(error instanceof AuthAccessError) || error.status === 403) {
      redirect("/access-denied");
    }
    redirect("/login");
  }
  const id = Number((await searchParams).invoice);
  return <ApprovalDeskClient weeklyReport={weeklyReport} initialInvoice={Number.isSafeInteger(id) && id > 0 ? id : null} />;
}

import { handleInvoiceList } from "@/lib/invoices/controller";
import { invoiceControllerDependencies } from "@/lib/invoices/controller-dependencies";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  return handleInvoiceList(request, invoiceControllerDependencies);
}

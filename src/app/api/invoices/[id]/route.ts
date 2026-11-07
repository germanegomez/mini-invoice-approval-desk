import { handleInvoiceDetail } from "@/lib/invoices/controller";
import { invoiceControllerDependencies } from "@/lib/invoices/controller-dependencies";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  return handleInvoiceDetail(id, invoiceControllerDependencies);
}

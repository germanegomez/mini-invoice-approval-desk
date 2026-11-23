import { requireAuthenticatedUser } from "@/lib/auth/guard";
import { client } from "@/db";
import { serveOriginal } from "@/lib/invoices/original";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return serveOriginal(request, (await params).id, {
    authenticate: requireAuthenticatedUser,
    async resolveLink(actor, invoice) {
      const [row] = await client`SELECT portal.invoice_original_link(${actor}::bigint, ${invoice}::integer) AS file_link`;
      return row?.file_link ?? null;
    },
  });
}
export const HEAD = GET;

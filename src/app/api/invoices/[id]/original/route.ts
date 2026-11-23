import { requireAuthenticatedUser } from "@/lib/auth/guard";
import { client } from "@/db";
import { readDriveFile } from "@/lib/invoices/drive";
import { serveOriginal } from "@/lib/invoices/original";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return serveOriginal(request, (await params).id, {
    authenticate: requireAuthenticatedUser,
    async resolveFile(actor, invoice) {
      const [row] = await client`SELECT portal.invoice_original_id(${actor}::bigint, ${invoice}::integer) AS file_id`;
      return row?.file_id ?? null;
    },
    readFile: readDriveFile,
  });
}
export const HEAD = GET;

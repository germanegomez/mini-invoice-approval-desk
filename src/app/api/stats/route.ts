import { db } from "@/db";
import { invoices } from "@/db/schema";
import { calculateStats } from "@/lib/stats";
import { requireAuthenticatedUser } from "@/lib/auth/guard";
import { authErrorResponse, privateJson } from "@/lib/auth/responses";

export async function GET() {
  try {
    await requireAuthenticatedUser();
    const rows = await db.select({ status: invoices.status, totalAmount: invoices.totalAmount, currency: invoices.currency }).from(invoices);
    return privateJson({ success: true, stats: calculateStats(rows) });
  } catch (error) {
    const authenticationError = authErrorResponse(error);
    if (authenticationError) return authenticationError;
    console.error("Invoice stats failed:", error);
    return privateJson({ success: false, error: "Failed to load invoice statistics" }, { status: 500 });
  }
}

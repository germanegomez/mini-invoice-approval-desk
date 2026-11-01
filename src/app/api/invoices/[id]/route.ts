import { NextRequest } from "next/server";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/guard";
import { authErrorResponse, privateJson } from "@/lib/auth/responses";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    await requireAuthenticatedUser();
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return privateJson({ success: false, error: "Invalid invoice ID" }, { status: 400 });
    }

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, id),
      with: {
        items: true,
        statusHistory: {
          orderBy: (history, { desc }) => [desc(history.createdAt)],
        },
        duplicateOf: {
          with: {
            items: true,
          },
        },
      },
    });

    if (!invoice) {
      return privateJson(
        { success: false, error: "Invoice not found" },
        { status: 404 }
      );
    }

    return privateJson({
      success: true,
      data: invoice,
    });
  } catch (error: unknown) {
    const authenticationError = authErrorResponse(error);
    if (authenticationError) return authenticationError;
    const message = "Failed to fetch invoice details";
    console.error("API GET /api/invoices/[id] error:", error);
    return privateJson(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

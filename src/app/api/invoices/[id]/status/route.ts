import { requireAuthenticatedUser } from "@/lib/auth/guard";
import { authErrorResponse, privateJson } from "@/lib/auth/responses";

export async function PATCH() {
  try {
    await requireAuthenticatedUser();
    return privateJson(
      {
        success: false,
        error: "Invoice status changes are disabled until permissions and transitions are implemented",
      },
      { status: 403 },
    );
  } catch (error) {
    const authenticationError = authErrorResponse(error);
    if (authenticationError) return authenticationError;
    console.error("Invoice status authorization failed");
    return privateJson({ success: false, error: "Authentication is unavailable" }, { status: 503 });
  }
}

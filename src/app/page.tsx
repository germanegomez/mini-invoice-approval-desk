import { redirect } from "next/navigation";
import { ApprovalDeskClient } from "@/components/ApprovalDeskClient";
import { AuthAccessError, requireAuthenticatedUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ApprovalDeskPage() {
  try {
    await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthAccessError && error.status === 403) {
      redirect("/access-denied");
    }
    redirect("/login");
  }
  return <ApprovalDeskClient />;
}

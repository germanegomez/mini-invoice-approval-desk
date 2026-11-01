import { FileCheck2 } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500 text-zinc-950">
            <FileCheck2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-bold">Mini Invoice Approval Desk</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Authorized clinic users only</p>
          </div>
        </div>
        <p className="mb-5 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          Use your organization Google account. Authentication does not grant access to invoices or business actions by itself.
        </p>
        <GoogleSignInButton />
      </section>
    </main>
  );
}

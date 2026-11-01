import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-bold">Access unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          This account cannot access the portal. Contact the administrator if you believe this is an error.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-amber-400"
        >
          Return to sign in
        </Link>
      </section>
    </main>
  );
}

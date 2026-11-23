import { z } from "zod";
import { parseUniversalRawId } from "./validation";

interface OriginalDependencies {
  authenticate(): Promise<{ id: string }>;
  resolveLink(actor: string, invoice: number): Promise<string | null>;
}

export async function serveOriginal(request: Request, id: string, deps: OriginalDependencies) {
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie",
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
  });
  try {
    const actor = await deps.authenticate();
    const link = await deps.resolveLink(actor.id, parseUniversalRawId(id));
    // The database canonicalizes stored WF05 links. Accept only that contract.
    const match = link?.match(/^https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{1,255})\/view(\?resourcekey=[A-Za-z0-9_-]{1,255})?$/);
    if (!match) return new Response("Original no disponible", { status: 404, headers });
    const mode = new URL(request.url).searchParams.get("preview") === "1" ? "preview" : "view";
    headers.set("Location", `https://drive.google.com/file/d/${match[1]}/${mode}${match[2] ?? ""}`);
    return new Response(null, { status: 302, headers });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400
      : error instanceof Error && "status" in error && (error.status === 401 || error.status === 403)
        ? error.status : 503;
    return new Response(null, { status, headers });
  }
}

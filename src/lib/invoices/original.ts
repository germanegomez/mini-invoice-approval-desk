import { z } from "zod";
import { parseUniversalRawId } from "./validation";

interface OriginalDependencies {
  authenticate(): Promise<{ id: string }>;
  resolveFile(actor: string, invoice: number): Promise<string | null>;
  readFile(id: string, metadataOnly: boolean, signal: AbortSignal): Promise<Response | null>;
}

export const originalTypes = new Map([
  ["application/pdf", "pdf"], ["image/jpeg", "jpg"], ["image/png", "png"],
  ["image/webp", "webp"], ["image/gif", "gif"],
]);

export async function serveOriginal(request: Request, id: string, deps: OriginalDependencies) {
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie",
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'",
  });
  function missing() {
    return new Response("Original no disponible", { status: 404, headers });
  }
  try {
    const actor = await deps.authenticate();
    const invoice = parseUniversalRawId(id);
    const file = await deps.resolveFile(actor.id, invoice);
    if (!file) return missing();
    const metadataOnly = request.method === "HEAD";
    const upstream = await deps.readFile(file, metadataOnly, request.signal);
    if (!upstream) return missing();
    const type = upstream.headers.get("content-type")?.split(";")[0].trim() ?? "";
    const extension = originalTypes.get(type);
    if (!extension) {
      await upstream.body?.cancel();
      return missing();
    }
    headers.set("Content-Type", type);
    headers.set("Content-Disposition", `inline; filename="factura-${invoice}.${extension}"`);
    return new Response(metadataOnly ? null : upstream.body, { headers });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400
      : error instanceof Error && "status" in error && (error.status === 401 || error.status === 403)
        ? error.status : 503;
    return new Response(null, { status, headers });
  }
}

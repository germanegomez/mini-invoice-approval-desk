import { z } from "zod";

const cursorSchema = z.object({
  v: z.literal(1),
  updatedAt: z.string().datetime({ offset: true }),
  universalRawId: z.number().int().positive().safe(),
}).strict();

export interface InvoiceCursor {
  updatedAt: string;
  universalRawId: number;
}

export function encodeInvoiceCursor(cursor: InvoiceCursor): string {
  return Buffer.from(JSON.stringify({ v: 1, ...cursor }), "utf8").toString("base64url");
}

export function decodeInvoiceCursor(value: string): InvoiceCursor {
  if (!/^[A-Za-z0-9_-]{8,512}$/.test(value)) throw new Error("Invalid cursor");
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed = cursorSchema.parse(JSON.parse(decoded));
    if (encodeInvoiceCursor(parsed) !== value) throw new Error("Non-canonical cursor");
    return { updatedAt: parsed.updatedAt, universalRawId: parsed.universalRawId };
  } catch {
    throw new Error("Invalid cursor");
  }
}

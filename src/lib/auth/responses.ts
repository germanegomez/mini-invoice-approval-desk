import { NextResponse } from "next/server";
import { AuthAccessError } from "./guard";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

export function privateJson(body: unknown, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers);
  for (const [name, value] of Object.entries(PRIVATE_HEADERS)) headers.set(name, value);
  return NextResponse.json(body, { ...init, headers });
}

export function authErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof AuthAccessError)) return null;
  return privateJson(
    { success: false, error: error.message },
    { status: error.status },
  );
}

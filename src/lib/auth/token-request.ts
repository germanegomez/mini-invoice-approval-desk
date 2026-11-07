import type { getToken } from "next-auth/jwt";

export interface NextAuthCookieStore {
  getAll(): Array<{ name: string; value: string }>;
}

export function createNextAuthTokenRequest(
  requestCookies: NextAuthCookieStore,
  requestHeaders: unknown,
): Parameters<typeof getToken>[0]["req"] {
  return {
    cookies: requestCookies,
    headers: requestHeaders,
  } as unknown as Parameters<typeof getToken>[0]["req"];
}

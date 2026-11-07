import "server-only";

import { cookies, headers } from "next/headers";
import { getToken } from "next-auth/jwt";
import { loadPortalUser } from "./repository";
import { portalUserMatchesToken, validatePortalTokenClaims } from "./session-claims";
import { createNextAuthTokenRequest } from "./token-request";

export class AuthAccessError extends Error {
  constructor(
    readonly status: 401 | 403 | 503,
    message: string,
  ) {
    super(message);
    this.name = "AuthAccessError";
  }
}

export interface AuthenticatedPortalUser {
  id: string;
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedPortalUser> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new AuthAccessError(503, "Authentication is unavailable");

  const requestHeaders = await headers();
  const requestCookies = await cookies();
  const request = createNextAuthTokenRequest(requestCookies, requestHeaders);
  const token = await getToken({
    req: request,
    secret,
    secureCookie: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false,
  });
  if (!token) throw new AuthAccessError(401, "Authentication required");

  const claims = validatePortalTokenClaims(token);
  if (!claims) throw new AuthAccessError(401, "Authentication required");

  let user;
  try {
    user = await loadPortalUser(claims.portalUserId);
  } catch {
    throw new AuthAccessError(503, "Authentication is unavailable");
  }
  if (!portalUserMatchesToken(user, claims)) {
    throw new AuthAccessError(403, "Access denied");
  }
  return { id: claims.portalUserId };
}

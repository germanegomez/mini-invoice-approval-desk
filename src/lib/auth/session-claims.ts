import { SESSION_MAX_AGE_SECONDS } from "./claims";

export interface PortalTokenClaims {
  portalUserId?: unknown;
  googleSubject?: unknown;
  authVersion?: unknown;
  authenticatedAt?: unknown;
}

export interface ValidPortalTokenClaims {
  portalUserId: string;
  googleSubject: string;
  authVersion: number;
  authenticatedAt: number;
}

export interface PortalUserSnapshot {
  id: string;
  googleSubject: string | null;
  authVersion: number;
  enabled: boolean;
}

export interface IssuedPortalIdentity {
  portalUserId: string;
  googleSubject: string;
  authVersion: number;
  authenticatedAt: number;
}

export function applyMinimalPortalIdentity<T extends Record<string, unknown>>(
  token: T,
  identity: IssuedPortalIdentity,
): T & IssuedPortalIdentity {
  delete token.name;
  delete token.email;
  delete token.picture;
  delete token.sub;
  delete token.accessToken;
  delete token.refreshToken;
  delete token.idToken;
  delete token.roles;
  delete token.permissions;
  return Object.assign(token, identity);
}

export function validatePortalTokenClaims(
  token: PortalTokenClaims,
  nowSeconds = Math.floor(Date.now() / 1000),
): ValidPortalTokenClaims | null {
  if (typeof token.portalUserId !== "string" || !/^\d+$/.test(token.portalUserId)) return null;
  if (typeof token.googleSubject !== "string" || !token.googleSubject) return null;
  if (!Number.isInteger(token.authVersion) || Number(token.authVersion) < 1) return null;
  if (!Number.isInteger(token.authenticatedAt) || Number(token.authenticatedAt) < 1) return null;
  if (nowSeconds < Number(token.authenticatedAt)) return null;
  if (nowSeconds - Number(token.authenticatedAt) >= SESSION_MAX_AGE_SECONDS) return null;
  return {
    portalUserId: token.portalUserId,
    googleSubject: token.googleSubject,
    authVersion: Number(token.authVersion),
    authenticatedAt: Number(token.authenticatedAt),
  };
}

export function portalUserMatchesToken(
  user: PortalUserSnapshot | null,
  token: ValidPortalTokenClaims,
): boolean {
  return Boolean(
    user
      && user.enabled
      && user.id === token.portalUserId
      && user.googleSubject === token.googleSubject
      && user.authVersion === token.authVersion,
  );
}

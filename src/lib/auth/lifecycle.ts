import type { GoogleOidcProfile } from "./claims";
import { validateGoogleClaims } from "./claims";
import { attachPortalIdentityToOAuthAccount } from "./session-claims";

type AuthorizationResult =
  | {
      ok: true;
      identity: {
        portalUserId: string;
        googleSubject: string;
        authVersion: number;
      };
    }
  | { ok: false; reason: string };

export interface AuthLifecycleDependencies {
  workspaceDomain?: string;
  createRequestId(): string;
  nowSeconds(): number;
  authorizeGoogleIdentity(
    email: string,
    subject: string,
    requestId: string,
  ): Promise<AuthorizationResult>;
  recordAuthRejection(reason: string, requestId: string): Promise<void>;
  recordLogout(portalUserId: string, requestId: string): Promise<void>;
  reportLogoutAuditFailure(): void;
}

interface SignInInput {
  account: ({ provider?: string } & object) | null;
  profile?: unknown;
}

export async function authorizeGoogleSignIn(
  { account, profile }: SignInInput,
  dependencies: AuthLifecycleDependencies,
): Promise<boolean> {
  const requestId = dependencies.createRequestId();
  if (account?.provider !== "google" || !profile) {
    await dependencies.recordAuthRejection("unsupported_provider", requestId);
    return false;
  }

  const claims = validateGoogleClaims(
    profile as GoogleOidcProfile,
    dependencies.workspaceDomain,
  );
  if (!claims.ok) {
    await dependencies.recordAuthRejection(claims.reason, requestId);
    return false;
  }

  const authorization = await dependencies.authorizeGoogleIdentity(
    claims.email,
    claims.subject,
    requestId,
  );
  if (!authorization.ok) return false;

  attachPortalIdentityToOAuthAccount(account as Record<string, unknown>, {
    ...authorization.identity,
    authenticatedAt: dependencies.nowSeconds(),
  });
  return true;
}

export async function auditPortalLogout(
  token: Record<string, unknown>,
  dependencies: AuthLifecycleDependencies,
): Promise<void> {
  if (typeof token.portalUserId !== "string") return;

  try {
    await dependencies.recordLogout(token.portalUserId, dependencies.createRequestId());
  } catch {
    dependencies.reportLogoutAuditFailure();
  }
}

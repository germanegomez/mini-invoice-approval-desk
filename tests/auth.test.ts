import test from "node:test";
import assert from "node:assert/strict";
import { decode, encode, getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";
import { SESSION_MAX_AGE_SECONDS, validateGoogleClaims } from "../src/lib/auth/claims";
import { sanitizeAuthErrorMetadata } from "../src/lib/auth/diagnostics";
import {
  auditPortalLogout,
  authorizeGoogleSignIn,
  type AuthLifecycleDependencies,
} from "../src/lib/auth/lifecycle";
import {
  applyMinimalPortalIdentity,
  attachPortalIdentityToOAuthAccount,
  portalUserMatchesToken,
  readPortalIdentityFromOAuthAccount,
  validatePortalTokenClaims,
} from "../src/lib/auth/session-claims";
import { createNextAuthTokenRequest } from "../src/lib/auth/token-request";

const domain = "clinicacruzceleste.com";
const validProfile = {
  sub: "google-subject-1",
  email: " Synthetic.User@clinicacruzceleste.com ",
  email_verified: true,
  hd: domain,
};

function lifecycleDependencies(
  overrides: Partial<AuthLifecycleDependencies> = {},
): AuthLifecycleDependencies {
  return {
    workspaceDomain: domain,
    createRequestId: () => "synthetic-request-id",
    nowSeconds: () => 2_000_000,
    authorizeGoogleIdentity: async () => ({
      ok: true,
      identity: {
        portalUserId: "42",
        googleSubject: "google-subject-1",
        authVersion: 3,
      },
    }),
    recordAuthRejection: async () => undefined,
    recordLogout: async () => undefined,
    reportLogoutAuditFailure: () => undefined,
    ...overrides,
  };
}

test("Google claims require the configured Workspace domain, verified email, subject and hosted-domain claim", () => {
  assert.deepEqual(validateGoogleClaims(validProfile, domain), {
    ok: true,
    subject: "google-subject-1",
    email: "synthetic.user@clinicacruzceleste.com",
  });
  assert.equal(validateGoogleClaims({ ...validProfile, hd: "other.example" }, domain).ok, false);
  assert.equal(validateGoogleClaims({ ...validProfile, hd: undefined }, domain).ok, false);
  assert.equal(validateGoogleClaims({ ...validProfile, email_verified: false }, domain).ok, false);
  assert.equal(validateGoogleClaims({ ...validProfile, sub: "" }, domain).ok, false);
  assert.equal(validateGoogleClaims({ ...validProfile, email: "invalid" }, domain).ok, false);
  assert.equal(validateGoogleClaims(validProfile, undefined).ok, false);
});

test("portal token claims enforce the absolute eight-hour lifetime", () => {
  const now = 2_000_000;
  const claims = {
    portalUserId: "42",
    googleSubject: "google-subject-1",
    authVersion: 3,
    authenticatedAt: now - SESSION_MAX_AGE_SECONDS + 1,
  };
  assert.ok(validatePortalTokenClaims(claims, now));
  assert.equal(
    validatePortalTokenClaims({ ...claims, authenticatedAt: now - SESSION_MAX_AGE_SECONDS }, now),
    null,
  );
  assert.equal(validatePortalTokenClaims({ ...claims, authVersion: 0 }, now), null);
  assert.equal(validatePortalTokenClaims({ ...claims, googleSubject: "" }, now), null);
  assert.equal(validatePortalTokenClaims({ ...claims, portalUserId: "altered" }, now), null);
});

test("database state must match subject and auth version on every protected access", () => {
  const token = validatePortalTokenClaims({
    portalUserId: "42",
    googleSubject: "google-subject-1",
    authVersion: 3,
    authenticatedAt: 1_999_999,
  }, 2_000_000);
  assert.ok(token);
  assert.equal(portalUserMatchesToken({ id: "42", googleSubject: "google-subject-1", authVersion: 3, enabled: true }, token), true);
  assert.equal(portalUserMatchesToken({ id: "42", googleSubject: "google-subject-1", authVersion: 4, enabled: true }, token), false);
  assert.equal(portalUserMatchesToken({ id: "42", googleSubject: "other", authVersion: 3, enabled: true }, token), false);
  assert.equal(portalUserMatchesToken({ id: "42", googleSubject: "google-subject-1", authVersion: 3, enabled: false }, token), false);
  assert.equal(portalUserMatchesToken(null, token), false);
});

test("issued sessions are encrypted JWE and retain only the minimum portal identity", async () => {
  const token = applyMinimalPortalIdentity<Record<string, unknown>>({
    sub: "provider-controlled-subject",
    name: "Synthetic User",
    email: "synthetic@example.invalid",
    picture: "https://example.invalid/avatar",
    accessToken: "google-access-token",
    refreshToken: "google-refresh-token",
    idToken: "google-id-token",
    roles: ["admin"],
    permissions: ["invoice.write"],
  }, {
    portalUserId: "42",
    googleSubject: "google-subject-1",
    authVersion: 3,
    authenticatedAt: 2_000_000,
  });
  assert.deepEqual(token, {
    portalUserId: "42",
    googleSubject: "google-subject-1",
    authVersion: 3,
    authenticatedAt: 2_000_000,
  });

  const secret = "synthetic-test-secret-that-is-long-enough";
  const jwe = await encode({ token: token as JWT, secret, maxAge: SESSION_MAX_AGE_SECONDS });
  assert.equal(jwe.includes("google-subject-1"), false);
  const decoded = await decode({ token: jwe, secret });
  assert.equal(decoded?.portalUserId, "42");
  assert.equal(decoded?.authVersion, 3);
  assert.equal(decoded?.accessToken, undefined);
});

test("NextAuth reads the encrypted session from the request cookie store", async () => {
  const secret = "synthetic-test-secret-that-is-long-enough";
  const jwe = await encode({
    token: {
      portalUserId: "42",
      googleSubject: "google-subject-1",
      authVersion: 3,
      authenticatedAt: Math.floor(Date.now() / 1000),
    },
    secret,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  const request = createNextAuthTokenRequest(
    { getAll: () => [{ name: "next-auth.session-token", value: jwe }] },
    new Headers(),
  );

  const decoded = await getToken({ req: request, secret, secureCookie: false });
  assert.equal(decoded?.portalUserId, "42");
  assert.equal(decoded?.googleSubject, "google-subject-1");
  assert.equal(decoded?.authVersion, 3);
});

test("authorized identity survives NextAuth rebuilding the user between sign-in and JWT callbacks", () => {
  const account = attachPortalIdentityToOAuthAccount<Record<string, unknown>>({
    provider: "google",
    type: "oauth",
    access_token: "provider-token-that-must-not-be-copied",
  }, {
    portalUserId: "42",
    googleSubject: "google-subject-1",
    authVersion: 3,
    authenticatedAt: Math.floor(Date.now() / 1000),
  });

  const rebuiltUser = { id: "google-profile-id" };
  assert.equal("portalUserId" in rebuiltUser, false);
  assert.deepEqual(readPortalIdentityFromOAuthAccount(account), {
    portalUserId: "42",
    googleSubject: "google-subject-1",
    authVersion: 3,
    authenticatedAt: account.authenticatedAt,
  });
  assert.equal(readPortalIdentityFromOAuthAccount(account)?.portalUserId, "42");
});

test("authentication diagnostics retain only bounded, sanitized cause metadata", () => {
  const diagnostic = sanitizeAuthErrorMetadata({
    providerId: "google",
    error: {
      name: "OAuthCallbackError",
      cause: {
        name: "OPError",
        message: "invalid_grant for user@example.invalid?code=secret-code&state=secret-state Bearer secret-token",
      },
      response: { status: 400, body: { id_token: "must-not-be-read" } },
      profile: { email: "must-not-be-read@example.invalid" },
    },
  });

  assert.deepEqual(diagnostic, {
    errorName: "OAuthCallbackError",
    errorType: "OPError",
    message: "invalid_grant for [redacted-email]?code=[redacted]&state=[redacted] Bearer [redacted]",
    provider: "google",
    status: 400,
  });
  assert.equal(JSON.stringify(diagnostic).includes("must-not-be-read"), false);
  assert.equal(JSON.stringify(diagnostic).includes("secret-code"), false);
});

test("rejected Google sign-in audits only a bounded reason and request ID", async () => {
  const rejectionCalls: unknown[][] = [];
  let authorizationCalled = false;
  const account = {
    provider: "google",
    access_token: "google-access-token-must-not-be-audited",
    id_token: "google-id-token-must-not-be-audited",
  };
  const accepted = await authorizeGoogleSignIn({
    account,
    profile: {
      ...validProfile,
      email: "rejected.user@example.invalid",
      hd: "wrong.example",
      nonce: "claim-must-not-be-audited",
    },
  }, lifecycleDependencies({
    authorizeGoogleIdentity: async () => {
      authorizationCalled = true;
      return { ok: false, reason: "not_preauthorized" };
    },
    recordAuthRejection: async (...args) => {
      rejectionCalls.push(args);
    },
  }));

  assert.equal(accepted, false);
  assert.equal(authorizationCalled, false);
  assert.deepEqual(rejectionCalls, [["wrong_hosted_domain", "synthetic-request-id"]]);
  const serializedAudit = JSON.stringify(rejectionCalls);
  for (const forbidden of [
    "rejected.user",
    "google-subject-1",
    "google-access-token",
    "google-id-token",
    "claim-must-not-be-audited",
  ]) {
    assert.equal(serializedAudit.includes(forbidden), false);
  }
});

test("accepted Google sign-in passes normalized identity and attaches minimal portal claims", async () => {
  const authorizationCalls: unknown[][] = [];
  const account = { provider: "google", type: "oauth" };
  const accepted = await authorizeGoogleSignIn({ account, profile: validProfile }, lifecycleDependencies({
    authorizeGoogleIdentity: async (...args) => {
      authorizationCalls.push(args);
      return {
        ok: true,
        identity: {
          portalUserId: "42",
          googleSubject: "google-subject-1",
          authVersion: 3,
        },
      };
    },
  }));

  assert.equal(accepted, true);
  assert.deepEqual(authorizationCalls, [[
    "synthetic.user@clinicacruzceleste.com",
    "google-subject-1",
    "synthetic-request-id",
  ]]);
  assert.deepEqual(account, {
    provider: "google",
    type: "oauth",
    portalUserId: "42",
    googleSubject: "google-subject-1",
    authVersion: 3,
    authenticatedAt: 2_000_000,
  });
});

test("logout audit uses only local identity and reports failures generically", async () => {
  const logoutCalls: unknown[][] = [];
  let genericFailureCount = 0;
  const sensitiveToken = {
    portalUserId: "42",
    email: "user@example.invalid",
    accessToken: "google-access-token-must-not-be-audited",
    refreshToken: "google-refresh-token-must-not-be-audited",
    idToken: "google-id-token-must-not-be-audited",
    cookie: "session-cookie-must-not-be-audited",
  };

  await auditPortalLogout(sensitiveToken, lifecycleDependencies({
    createRequestId: () => "logout-request-id",
    recordLogout: async (...args) => {
      logoutCalls.push(args);
    },
  }));
  assert.deepEqual(logoutCalls, [["42", "logout-request-id"]]);

  await auditPortalLogout(sensitiveToken, lifecycleDependencies({
    recordLogout: async () => {
      throw new Error("database detail must not be logged");
    },
    reportLogoutAuditFailure: () => {
      genericFailureCount += 1;
    },
  }));
  await auditPortalLogout({ email: "no-local-identity@example.invalid" }, lifecycleDependencies({
    recordLogout: async (...args) => {
      logoutCalls.push(args);
    },
  }));

  assert.equal(genericFailureCount, 1);
  assert.equal(logoutCalls.length, 1);
  const serializedAudit = JSON.stringify(logoutCalls);
  for (const forbidden of [
    "user@example.invalid",
    "google-access-token",
    "google-refresh-token",
    "google-id-token",
    "session-cookie",
  ]) {
    assert.equal(serializedAudit.includes(forbidden), false);
  }
});

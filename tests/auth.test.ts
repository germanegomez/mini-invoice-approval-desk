import test from "node:test";
import assert from "node:assert/strict";
import { decode, encode } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";
import { SESSION_MAX_AGE_SECONDS, validateGoogleClaims } from "../src/lib/auth/claims";
import {
  applyMinimalPortalIdentity,
  portalUserMatchesToken,
  validatePortalTokenClaims,
} from "../src/lib/auth/session-claims";

const domain = "clinicacruzceleste.com";
const validProfile = {
  sub: "google-subject-1",
  email: " Synthetic.User@clinicacruzceleste.com ",
  email_verified: true,
  hd: domain,
};

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

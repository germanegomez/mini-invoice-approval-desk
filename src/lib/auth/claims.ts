export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export type GoogleClaimRejection =
  | "auth_configuration_invalid"
  | "missing_subject"
  | "missing_email"
  | "email_not_verified"
  | "missing_hosted_domain"
  | "wrong_hosted_domain";

export interface GoogleOidcProfile {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  hd?: unknown;
}

export type ValidatedGoogleIdentity = {
  ok: true;
  subject: string;
  email: string;
};

export type RejectedGoogleIdentity = {
  ok: false;
  reason: GoogleClaimRejection;
};

const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function normalizeEmail(value: string): string | null {
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  if (normalized.length > 320 || !EMAIL_PATTERN.test(normalized)) return null;
  return normalized;
}

export function validateGoogleClaims(
  profile: GoogleOidcProfile,
  expectedDomain: string | undefined,
): ValidatedGoogleIdentity | RejectedGoogleIdentity {
  if (!expectedDomain || expectedDomain !== expectedDomain.trim().toLowerCase()) {
    return { ok: false, reason: "auth_configuration_invalid" };
  }
  if (typeof profile.sub !== "string" || !profile.sub.trim()) {
    return { ok: false, reason: "missing_subject" };
  }
  if (typeof profile.email !== "string") {
    return { ok: false, reason: "missing_email" };
  }
  const email = normalizeEmail(profile.email);
  if (!email) return { ok: false, reason: "missing_email" };
  if (profile.email_verified !== true) {
    return { ok: false, reason: "email_not_verified" };
  }
  if (typeof profile.hd !== "string" || !profile.hd) {
    return { ok: false, reason: "missing_hosted_domain" };
  }
  if (profile.hd !== expectedDomain) {
    return { ok: false, reason: "wrong_hosted_domain" };
  }
  return { ok: true, subject: profile.sub.trim(), email };
}

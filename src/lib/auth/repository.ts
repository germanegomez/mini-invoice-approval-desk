import "server-only";

import { client } from "@/db";
import type { PortalUserSnapshot } from "./session-claims";

export type IdentityAuthorizationOutcome =
  | "linked"
  | "accepted"
  | "not_preauthorized"
  | "disabled"
  | "subject_collision"
  | "subject_mismatch";

interface IdentityAuthorizationRow {
  user_id: string | number | null;
  google_subject: string | null;
  auth_version: number | null;
  outcome: IdentityAuthorizationOutcome;
}

export interface AuthorizedPortalIdentity {
  portalUserId: string;
  googleSubject: string;
  authVersion: number;
}

export async function authorizeGoogleIdentity(
  email: string,
  subject: string,
  requestId: string,
): Promise<{ ok: true; identity: AuthorizedPortalIdentity } | { ok: false; reason: IdentityAuthorizationOutcome }> {
  const rows = await client`
    SELECT user_id, google_subject, auth_version, outcome
      FROM portal.authorize_google_identity(${email}, ${subject}, ${requestId})
  ` as unknown as IdentityAuthorizationRow[];
  const row = rows[0];
  if (!row || row.outcome !== "linked" && row.outcome !== "accepted") {
    return { ok: false, reason: row?.outcome ?? "not_preauthorized" };
  }
  if (row.user_id === null || !row.google_subject || !row.auth_version) {
    return { ok: false, reason: "not_preauthorized" };
  }
  return {
    ok: true,
    identity: {
      portalUserId: String(row.user_id),
      googleSubject: row.google_subject,
      authVersion: Number(row.auth_version),
    },
  };
}

export async function recordAuthRejection(reason: string, requestId: string): Promise<void> {
  await client`
    INSERT INTO portal.audit_events(
      action, resource_type, resource_id, reason, result, request_id
    ) VALUES (
      'auth.login', 'authentication', 'google', ${reason}, 'rejected', ${requestId}
    )
  `;
}

export async function recordLogout(portalUserId: string, requestId: string): Promise<void> {
  await client`
    INSERT INTO portal.audit_events(
      actor_user_id, action, resource_type, resource_id, result, request_id
    ) VALUES (
      ${portalUserId}::bigint, 'auth.logout', 'portal_user', ${portalUserId}, 'success', ${requestId}
    )
  `;
}

export async function loadPortalUser(portalUserId: string): Promise<PortalUserSnapshot | null> {
  const rows = await client`
    SELECT id, google_subject, auth_version, enabled
      FROM portal.users
     WHERE id = ${portalUserId}::bigint
  ` as unknown as Array<{
    id: string | number;
    google_subject: string | null;
    auth_version: number;
    enabled: boolean;
  }>;
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    googleSubject: row.google_subject,
    authVersion: Number(row.auth_version),
    enabled: row.enabled,
  };
}

import { randomUUID } from "node:crypto";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { validateGoogleClaims, SESSION_MAX_AGE_SECONDS, type GoogleOidcProfile } from "./claims";
import { authorizeGoogleIdentity, recordAuthRejection, recordLogout } from "./repository";
import { applyMinimalPortalIdentity } from "./session-claims";

type PortalAuthUser = {
  portalUserId?: string;
  googleSubject?: string;
  authVersion?: number;
  authenticatedAt?: number;
};

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: "openid email profile",
          hd: process.env.GOOGLE_WORKSPACE_DOMAIN ?? "",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/access-denied",
  },
  callbacks: {
    async signIn({ account, profile, user }) {
      const requestId = randomUUID();
      if (account?.provider !== "google" || !profile) {
        await recordAuthRejection("unsupported_provider", requestId);
        return false;
      }
      const claims = validateGoogleClaims(
        profile as GoogleOidcProfile,
        process.env.GOOGLE_WORKSPACE_DOMAIN,
      );
      if (!claims.ok) {
        await recordAuthRejection(claims.reason, requestId);
        return false;
      }
      const authorization = await authorizeGoogleIdentity(
        claims.email,
        claims.subject,
        requestId,
      );
      if (!authorization.ok) return false;
      Object.assign(user as PortalAuthUser, authorization.identity, {
        authenticatedAt: Math.floor(Date.now() / 1000),
      });
      return true;
    },
    async jwt({ token, user, account }) {
      const portalUser = user as PortalAuthUser | undefined;
      if (
        account?.provider === "google"
        && portalUser?.portalUserId
        && portalUser.googleSubject
        && portalUser.authVersion
        && portalUser.authenticatedAt
      ) {
        applyMinimalPortalIdentity(token, {
          portalUserId: portalUser.portalUserId,
          googleSubject: portalUser.googleSubject,
          authVersion: portalUser.authVersion,
          authenticatedAt: portalUser.authenticatedAt,
        });
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.portalUserId === "string") {
        session.user.id = token.portalUserId;
        delete session.user.email;
        delete session.user.image;
        delete session.user.name;
      }
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      if (typeof token.portalUserId === "string") {
        try {
          await recordLogout(token.portalUserId, randomUUID());
        } catch {
          console.error("Authentication audit unavailable during logout");
        }
      }
    },
  },
  logger: {
    error(code) {
      console.error("Authentication error:", code);
    },
    warn(code) {
      console.warn("Authentication warning:", code);
    },
    debug() {
      // Authentication debug output is intentionally disabled to avoid claims or token logs.
    },
  },
};

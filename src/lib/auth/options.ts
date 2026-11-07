import { randomUUID } from "node:crypto";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { SESSION_MAX_AGE_SECONDS } from "./claims";
import { sanitizeAuthErrorMetadata } from "./diagnostics";
import { auditPortalLogout, authorizeGoogleSignIn } from "./lifecycle";
import { authorizeGoogleIdentity, recordAuthRejection, recordLogout } from "./repository";
import {
  applyMinimalPortalIdentity,
  readPortalIdentityFromOAuthAccount,
} from "./session-claims";

const authLifecycleDependencies = {
  workspaceDomain: process.env.GOOGLE_WORKSPACE_DOMAIN,
  createRequestId: randomUUID,
  nowSeconds: () => Math.floor(Date.now() / 1000),
  authorizeGoogleIdentity,
  recordAuthRejection,
  recordLogout,
  reportLogoutAuditFailure: () => {
    console.error("Authentication audit unavailable during logout");
  },
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
          prompt: "select_account",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/access-denied",
  },
  callbacks: {
    async signIn({ account, profile }) {
      return authorizeGoogleSignIn({ account, profile }, authLifecycleDependencies);
    },
    async jwt({ token, account }) {
      const portalIdentity = account?.provider === "google"
        ? readPortalIdentityFromOAuthAccount(account)
        : null;
      if (portalIdentity) {
        applyMinimalPortalIdentity(token, portalIdentity);
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
      await auditPortalLogout(token, authLifecycleDependencies);
    },
  },
  logger: {
    error(code, metadata) {
      console.error("Authentication error:", code, sanitizeAuthErrorMetadata(metadata));
    },
    warn(code) {
      console.warn("Authentication warning:", code);
    },
    debug() {
      // Authentication debug output is intentionally disabled to avoid claims or token logs.
    },
  },
};

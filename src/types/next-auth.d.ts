import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & { id: string };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    portalUserId?: string;
    googleSubject?: string;
    authVersion?: number;
    authenticatedAt?: number;
  }
}

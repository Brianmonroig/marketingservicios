import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { requiredEnv } from "@/lib/env";

declare module "next-auth" {
  interface Session {
    accessToken: string;
    user: DefaultSession["user"] & {
      id: string;
      role: string;
      tenantId: string;
      agencyName: string;
    };
  }

  interface User {
    role: string;
    tenantId: string;
    agencyName: string;
    accessToken: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: {},
        challengeId: {},
        code: {},
      },
      authorize: async (credentials) => {
        const response = await fetch(`${requiredEnv("API_URL")}/auth/verify-2fa`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: credentials?.email,
            challengeId: credentials?.challengeId,
            code: credentials?.code,
          }),
        });
        if (!response.ok) return null;
        const data = (await response.json()) as {
          token: string;
          user: { id: string; email: string; name: string; role: string; tenantId: string; agencyName: string };
        };
        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role,
          tenantId: data.user.tenantId,
          agencyName: data.user.agencyName,
          accessToken: data.token,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.agencyName = user.agencyName;
        token.accessToken = user.accessToken;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.role = String(token.role ?? "");
      session.user.tenantId = String(token.tenantId ?? "");
      session.user.agencyName = String(token.agencyName ?? "");
      session.accessToken = String(token.accessToken ?? "");
      return session;
    },
    authorized({ auth: session, request }) {
      if (request.nextUrl.pathname.startsWith("/app")) return !!session;
      return true;
    },
  },
});

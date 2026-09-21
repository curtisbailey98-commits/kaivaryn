import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";
import type { Role } from "@/lib/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: Role;
      organizationId?: string | null;
      membershipRole?: Role | null;
    };
  }
  interface User {
    id: string;
    email: string;
    name?: string | null;
    role: Role;
    organizationId?: string | null;
    membershipRole?: Role | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    organizationId?: string | null;
    membershipRole?: Role | null;
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const email = credentials.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            memberships: { orderBy: { createdAt: "asc" }, take: 1 },
          },
        });
        if (!user) return null;
        const valid = await compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        const membership = user.memberships[0];
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
          organizationId: membership?.organizationId ?? null,
          membershipRole: (membership?.role as Role) ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.membershipRole = user.membershipRole;
      } else if (token.id) {
        // refresh membership on each token use lightly
        const membership = await prisma.membership.findFirst({
          where: { userId: token.id },
          orderBy: { createdAt: "asc" },
        });
        token.organizationId = membership?.organizationId ?? null;
        token.membershipRole = (membership?.role as Role) ?? null;
        const dbUser = await prisma.user.findUnique({ where: { id: token.id } });
        if (dbUser) token.role = dbUser.role as Role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.organizationId = token.organizationId;
        session.user.membershipRole = token.membershipRole;
      }
      return session;
    },
  },
};

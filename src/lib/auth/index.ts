import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { admin, twoFactor } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { emailService } from "@/lib/email";
import { env } from "@/lib/env";

const ac = createAccessControl({});
export const roles = {
  customer: ac.newRole({}),
  staff: ac.newRole({}),
  admin: ac.newRole({}),
  owner: ac.newRole({}),
};

export const auth = betterAuth({
  appName: "Mercato",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      twoFactor: schema.twoFactor,
    },
  }),
  emailVerification: {
    sendOnSignUp: false,
    sendVerificationEmail: async ({ user, url, token }) => {
      await emailService.sendVerificationEmail({
        to: user.email,
        url,
        token,
        userName: user.name,
      });
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url, token }) => {
      await emailService.sendPasswordResetEmail({
        to: user.email,
        url,
        token,
        userName: user.name,
      });
    },
  },
  socialProviders: {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  plugins: [
    admin({
      ac,
      roles,
      defaultRole: "customer",
      adminRoles: ["admin", "owner"],
    }),
    twoFactor({
      issuer: "Mercato",
    }),
  ],
  user: {
    additionalFields: {
      storeId: {
        type: "string",
        required: false,
      },
    },
  },
});

export type Auth = typeof auth;

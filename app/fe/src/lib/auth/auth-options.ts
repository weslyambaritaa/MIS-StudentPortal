import type { NextAuthOptions } from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";
import { decodeJwt } from "jose";

import { refreshAccessToken } from "./refresh-token";

const BUSINESS_ROLES = [
  "student",
  "pic",
  "trainer",
  "sales",
  "admin",
  "super_admin",
  "finance",
  "management",
] as const;

function getBusinessRoles(accessToken: string): string[] {
  const decoded = decodeJwt(accessToken);

  const realmAccess = decoded.realm_access as
    | {
        roles?: string[];
      }
    | undefined;

  const realmRoles = realmAccess?.roles ?? [];

  return realmRoles.filter((role) =>
    BUSINESS_ROLES.includes(role as (typeof BUSINESS_ROLES)[number])
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async jwt({ token, account }) {
      /*
       * Login pertama dari Keycloak.
       */
      if (account?.access_token) {
        return {
          ...token,

          /*
           * Token yang digunakan untuk mengakses API.
           */
          accessToken: account.access_token,

          /*
           * Digunakan untuk mendapatkan access token baru
           * ketika access token sudah expired.
           */
          refreshToken: account.refresh_token,

          /*
           * Digunakan untuk logout dari session SSO Keycloak.
           */
          idToken: account.id_token,

          /*
           * expires_at dari Keycloak menggunakan detik.
           * Kita ubah menjadi millisecond.
           */
          accessTokenExpires: (account.expires_at ?? 0) * 1000,

          /*
           * Hanya simpan role bisnis aplikasi.
           *
           * Contoh:
           * student
           *
           * Bukan:
           * offline_access
           * uma_authorization
           * default-roles-mis-student-portal
           */
          roles: getBusinessRoles(account.access_token),
        };
      }

      /*
       * Kalau access token masih valid,
       * tidak perlu refresh.
       *
       * Kita beri toleransi 30 detik sebelum expired.
       */
      if (
        typeof token.accessTokenExpires === "number" &&
        Date.now() < token.accessTokenExpires - 30_000
      ) {
        return token;
      }

      /*
       * Kalau access token expired / hampir expired,
       * gunakan refresh token.
       */
      if (token.refreshToken) {
        return refreshAccessToken(token);
      }

      /*
       * Kalau tidak ada refresh token,
       * kembalikan token saat ini.
       */
      return token;
    },

    async session({ session, token }) {
      /*
       * Access token digunakan frontend untuk request
       * ke API Gateway.
       */
      session.accessToken = token.accessToken as string | undefined;

      /*
       * ID token digunakan saat logout Keycloak.
       */
      session.idToken = token.idToken as string | undefined;

      /*
       * Role bisnis aplikasi.
       */
      session.user.roles = (token.roles as string[]) ?? [];

      /*
       * Error dari proses refresh token jika ada.
       */
      session.error = token.error as string | undefined;

      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
};

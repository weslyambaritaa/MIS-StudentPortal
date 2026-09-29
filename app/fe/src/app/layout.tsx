import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

import { KeycloakAuthProvider } from "@/providers/keycloak-provider";
import { ActiveRoleRouteGuard } from "@/components/auth/active-role-route-guard";

export const metadata: Metadata = {
  title: "MIS Student Portal",
  description: "Student Portal & MIS",
};

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={dmSans.variable}>
        <KeycloakAuthProvider>
          <ActiveRoleRouteGuard>{children}</ActiveRoleRouteGuard>
        </KeycloakAuthProvider>
      </body>
    </html>
  );
}

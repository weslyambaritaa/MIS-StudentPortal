import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

import { KeycloakAuthProvider } from "@/providers/keycloak-provider";
import { ActiveRoleRouteGuard } from "@/components/auth/active-role-route-guard";
import { ToastProvider } from "@mis/ui/toast";

export const metadata: Metadata = {
  title: "MIS Student Portal",
  description: "Student Portal & MIS",
};

const dmSans = localFont({
  src: "../../public/fonts/dm-sans-latin.woff2",
  weight: "400 700",
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
          <ToastProvider>
            <ActiveRoleRouteGuard>{children}</ActiveRoleRouteGuard>
          </ToastProvider>
        </KeycloakAuthProvider>
      </body>
    </html>
  );
}

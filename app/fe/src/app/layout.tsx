import type { Metadata } from "next";
import "./globals.css";

import { KeycloakAuthProvider } from "@/providers/keycloak-provider";

export const metadata: Metadata = {
  title: "MIS Student Portal",
  description: "Student Portal & MIS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <KeycloakAuthProvider>{children}</KeycloakAuthProvider>
      </body>
    </html>
  );
}

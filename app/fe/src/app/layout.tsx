import type { Metadata } from "next";
import "./globals.css";
import { AppSessionProvider } from "@/providers/session-provider";

export const metadata: Metadata = {
  title: "MIS Student Portal",
  description: "Student Portal & MIS",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppSessionProvider>{children}</AppSessionProvider>
      </body>
    </html>
  );
}

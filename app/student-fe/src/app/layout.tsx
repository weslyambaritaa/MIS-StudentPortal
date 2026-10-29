import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { StudentPortalAuthProvider } from "@/providers/student-portal-auth-provider";

const dmSans = localFont({
  src: "../../public/fonts/dm-sans-latin.woff2",
  weight: "400 700",
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Student Portal | ExecuTrain",
  description: "Student and PIC portal",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={dmSans.variable}>
        <StudentPortalAuthProvider>{children}</StudentPortalAuthProvider>
      </body>
    </html>
  );
}

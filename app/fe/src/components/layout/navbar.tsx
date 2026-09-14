"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export function Navbar() {
  return (
    <nav className="flex items-center justify-between border-b bg-white px-6 py-4">
      <Link href="/dashboard" className="font-semibold">MIS Student Portal</Link>
      <div className="flex items-center gap-4">
        <Link href="/dashboard">Dashboard</Link>
        <button onClick={() => signOut({ callbackUrl: "/" })}>Logout</button>
      </div>
    </nav>
  );
}

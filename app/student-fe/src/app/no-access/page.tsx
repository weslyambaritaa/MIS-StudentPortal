"use client";

import { useStudentPortalAuth } from "@/providers/student-portal-auth-provider";

export default function NoAccessPage() {
  const { keycloak } = useStudentPortalAuth();
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">Student Portal access is not assigned</h1>
        <p className="mt-3 text-sm text-slate-600">This account needs the Student or PIC role to use this portal.</p>
        <button className="mt-6 rounded-full bg-rose-600 px-5 py-2.5 font-medium text-white" onClick={() => void keycloak.logout({ redirectUri: window.location.origin })}>
          Sign out
        </button>
      </section>
    </main>
  );
}

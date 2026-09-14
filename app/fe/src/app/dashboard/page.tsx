import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/auth-options";
import { AppShell } from "@/components/layout/app-shell";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold">Welcome</h1>
      <p className="mt-2">Welcome to MIS Student Portal.</p>
      <p className="mt-4 text-sm text-gray-600">{session.user.email}</p>
    </AppShell>
  );
}

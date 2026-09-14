import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/auth-options";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  redirect(session ? "/dashboard" : "/login");
}

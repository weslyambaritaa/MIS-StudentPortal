import { redirect } from "next/navigation";

export default function Page() {
  redirect("/admin/trainings?tab=requested");
}

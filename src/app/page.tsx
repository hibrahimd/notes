import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) {
    if (user.role === "admin") {
      return redirect("/admin");
    }
    return redirect("/dashboard");
  }
  return redirect("/login");
}

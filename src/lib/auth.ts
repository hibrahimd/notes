import { prisma } from "./prisma";
import { getSession } from "./session";
import { redirect } from "next/navigation";

export async function requireAuth() {
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });
  if (!user) {
    session.destroy();
    redirect("/login");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "admin") {
    redirect("/dashboard");
  }
  return user;
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session.userId) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
  });
}

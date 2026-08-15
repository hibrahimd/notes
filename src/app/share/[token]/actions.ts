"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcryptjs from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sealShareAccess, shareCookieName } from "@/lib/share-access";

/** Sifre korumali paylasim linkinin kilidini acar. */
export async function unlockShare(formData: FormData) {
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");

  const share = await prisma.share.findUnique({ where: { token } });

  const ok =
    share?.passwordHash && (await bcryptjs.compare(password, share.passwordHash));

  if (!share || !ok) {
    redirect(`/share/${encodeURIComponent(token)}?hata=1`);
  }

  const cookieStore = await cookies();
  cookieStore.set(shareCookieName(share.id), await sealShareAccess(share.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  redirect(`/share/${encodeURIComponent(token)}`);
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { generateToken } from "@/lib/tokens";

export async function POST() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { token, prefix, hash } = await generateToken();

  await prisma.userSettings.upsert({
    where: { userId: session.userId },
    update: { shortcutTokenHash: hash, shortcutTokenPrefix: prefix },
    create: {
      userId: session.userId,
      shortcutTokenHash: hash,
      shortcutTokenPrefix: prefix,
    },
  });

  return NextResponse.json({
    token,
    message: "Bu token'ı bir yere kaydedin. Tekrar gösterilmeyecektir.",
  });
}

export async function DELETE() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  await prisma.userSettings.update({
    where: { userId: session.userId },
    data: { shortcutTokenHash: null, shortcutTokenPrefix: null },
  });

  return NextResponse.json({ message: "Shortcut token'ı silindi" });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { v4 as uuidv4 } from "uuid";
import bcryptjs from "bcryptjs";

export async function POST() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const token = `notal_${uuidv4().replace(/-/g, "")}`;
  const tokenHash = await bcryptjs.hash(token, 10);

  await prisma.userSettings.upsert({
    where: { userId: session.userId },
    update: { shortcutTokenHash: tokenHash },
    create: { userId: session.userId, shortcutTokenHash: tokenHash },
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
    data: { shortcutTokenHash: null },
  });

  return NextResponse.json({ message: "Shortcut token'ı silindi" });
}

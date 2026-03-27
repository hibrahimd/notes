import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.userId },
  });

  if (!settings?.shortcutTokenHash) {
    return NextResponse.json({ error: "Token bulunamadı" }, { status: 404 });
  }

  // Generate a temporary share token that maps to user's shortcut token
  const shareToken = uuidv4();
  
  // Store mapping in database (we'll create a new table for this)
  // For now, return a session-based download link
  return NextResponse.json({
    downloadUrl: `/api/shortcut/download?user=${session.userId}`,
  });
}

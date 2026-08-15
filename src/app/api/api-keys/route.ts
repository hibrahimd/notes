import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { generateToken } from "@/lib/tokens";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.userId, revokedAt: null },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { name } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Anahtar adı gerekli" }, { status: 400 });
  }

  const { token, prefix, hash } = await generateToken();

  await prisma.apiKey.create({
    data: {
      userId: session.userId,
      name: name.trim().slice(0, 100),
      keyHash: hash,
      keyPrefix: prefix,
    },
  });

  return NextResponse.json({ key: token }, { status: 201 });
}

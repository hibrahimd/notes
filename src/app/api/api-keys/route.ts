import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { v4 as uuidv4 } from "uuid";
import bcryptjs from "bcryptjs";

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
  if (!name) {
    return NextResponse.json({ error: "Anahtar adı gerekli" }, { status: 400 });
  }

  const rawKey = `notal_${uuidv4().replace(/-/g, "")}`;
  const keyHash = await bcryptjs.hash(rawKey, 10);
  const keyPrefix = rawKey.slice(0, 12);

  await prisma.apiKey.create({
    data: {
      userId: session.userId,
      name,
      keyHash,
      keyPrefix,
    },
  });

  return NextResponse.json({ key: rawKey }, { status: 201 });
}

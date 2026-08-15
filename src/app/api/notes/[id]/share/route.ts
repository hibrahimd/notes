import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { v4 as uuidv4 } from "uuid";
import bcryptjs from "bcryptjs";

const MAX_EXPIRY_DAYS = 365;

interface ShareOptions {
  expiresInDays?: number | null;
  /** Bos/eksik ise mevcut sifre korunur; degistirmek icin yeni sifre gonderin */
  password?: string | null;
  /** Mevcut sifreyi tamamen kaldirir */
  removePassword?: boolean;
  maxViews?: number | null;
}

function parseOptions(body: ShareOptions) {
  const data: {
    expiresAt: Date | null;
    maxViews: number | null;
    passwordHash?: string | null;
  } = { expiresAt: null, maxViews: null };

  const days = Number(body.expiresInDays);
  if (Number.isFinite(days) && days > 0) {
    const clamped = Math.min(days, MAX_EXPIRY_DAYS);
    data.expiresAt = new Date(Date.now() + clamped * 24 * 60 * 60 * 1000);
  }

  const views = Number(body.maxViews);
  if (Number.isFinite(views) && views > 0) {
    data.maxViews = Math.floor(views);
  }

  return data;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { id } = await params;

  const note = await prisma.note.findFirst({
    where: { id, userId: session.userId },
  });

  if (!note) {
    return NextResponse.json({ error: "Not bulunamadı" }, { status: 404 });
  }

  let body: ShareOptions = {};
  try {
    body = await req.json();
  } catch {
    // Gövdesiz istek = korumasız paylaşım
  }

  const options = parseOptions(body);
  const password = typeof body.password === "string" ? body.password.trim() : "";

  // Ayni not icin zaten bir paylasim varsa link degismesin, sadece
  // korumalari guncelle
  const existing = await prisma.share.findFirst({
    where: { noteId: id, createdByUserId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  // Sifre alani bos birakildiginda mevcut sifre korunur; kaldirmak icin
  // istemci acikca removePassword gonderir
  let passwordHash: string | null | undefined;
  if (body.removePassword) {
    passwordHash = null;
  } else if (password) {
    passwordHash = await bcryptjs.hash(password, 10);
  } else {
    passwordHash = existing ? undefined : null;
  }

  const share = existing
    ? await prisma.share.update({
        where: { id: existing.id },
        data: {
          ...options,
          ...(passwordHash === undefined ? {} : { passwordHash }),
        },
      })
    : await prisma.share.create({
        data: {
          noteId: id,
          createdByUserId: session.userId,
          token: uuidv4(),
          ...options,
          passwordHash: passwordHash ?? null,
        },
      });

  return NextResponse.json(
    {
      share: {
        id: share.id,
        token: share.token,
        expiresAt: share.expiresAt,
        maxViews: share.maxViews,
        currentViews: share.currentViews,
        hasPassword: Boolean(share.passwordHash),
      },
      url: `/share/${share.token}`,
    },
    { status: existing ? 200 : 201 }
  );
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.share.deleteMany({
    where: {
      noteId: id,
      createdByUserId: session.userId,
    },
  });

  return NextResponse.json({ message: "Paylaşım kaldırıldı" });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import bcryptjs from "bcryptjs";

/**
 * Bir kod en fazla bu kadar yanlis denemeye dayanir, sonra yakilir.
 * request-code 10 dakikada 3 kod ile sinirli oldugundan bu, 6 haneli kod
 * uzayinda kaba kuvvet denemesini pratikte imkansiz kilar.
 */
const MAX_ATTEMPTS_PER_CODE = 5;

/** Kullanici numaralandirmasini onlemek icin tum basarisiz yollar ayni cevabi doner. */
function invalid() {
  return NextResponse.json(
    { error: "Geçersiz veya süresi dolmuş kod" },
    { status: 401 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email ve kod gerekli" },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Kullanici yoksa da gecersiz kod ile ayni cevap: hangi emaillerin kayitli
    // oldugu disaridan anlasilmasin
    if (!user) {
      return invalid();
    }

    const activeCodes = await prisma.loginCode.findMany({
      where: {
        userId: user.id,
        consumedAt: null,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const usableCodes = activeCodes.filter(
      (lc) => lc.attempts < MAX_ATTEMPTS_PER_CODE
    );

    if (activeCodes.length > 0 && usableCodes.length === 0) {
      return NextResponse.json(
        { error: "Çok fazla yanlış deneme. Yeni bir kod isteyin." },
        { status: 429 }
      );
    }

    let matchedCodeId: string | null = null;
    for (const lc of usableCodes) {
      if (await bcryptjs.compare(String(code), lc.codeHash)) {
        matchedCodeId = lc.id;
        break;
      }
    }

    if (!matchedCodeId) {
      if (usableCodes.length > 0) {
        const ids = usableCodes.map((lc) => lc.id);
        await prisma.loginCode.updateMany({
          where: { id: { in: ids } },
          data: { attempts: { increment: 1 } },
        });

        // Limite ulasan kodlari tamamen gecersiz kil
        await prisma.loginCode.updateMany({
          where: {
            id: { in: ids },
            attempts: { gte: MAX_ATTEMPTS_PER_CODE },
            consumedAt: null,
          },
          data: { consumedAt: new Date() },
        });
      }
      return invalid();
    }

    await prisma.loginCode.update({
      where: { id: matchedCodeId },
      data: { consumedAt: new Date() },
    });

    // Basarili girisin ardindan bu kullaniciya ait diger acik kodlari da kapat
    await prisma.loginCode.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const session = await getSession();
    session.userId = user.id;
    session.role = user.role;
    session.email = user.email;
    await session.save();

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Verify code error:", error);
    return NextResponse.json(
      { error: "Doğrulama sırasında hata oluştu" },
      { status: 500 }
    );
  }
}

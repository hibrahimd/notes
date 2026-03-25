import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import bcryptjs from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email ve kod gerekli" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Kullanıcı bulunamadı" },
        { status: 404 }
      );
    }

    const loginCodes = await prisma.loginCode.findMany({
      where: {
        userId: user.id,
        consumedAt: null,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    let validCode = false;
    let matchedCodeId: string | null = null;

    for (const lc of loginCodes) {
      const match = await bcryptjs.compare(code, lc.codeHash);
      if (match) {
        validCode = true;
        matchedCodeId = lc.id;
        break;
      }
    }

    if (!validCode || !matchedCodeId) {
      return NextResponse.json(
        { error: "Geçersiz veya süresi dolmuş kod" },
        { status: 401 }
      );
    }

    await prisma.loginCode.update({
      where: { id: matchedCodeId },
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

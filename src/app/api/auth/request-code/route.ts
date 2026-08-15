import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/utils";
import { sendLoginCode } from "@/lib/email";
import bcryptjs from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email gerekli" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Rate limit: max 3 codes in 10 minutes
    const recentCodes = await prisma.loginCode.count({
      where: {
        user: { email: normalizedEmail },
        createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      },
    });

    if (recentCodes >= 3) {
      return NextResponse.json(
        { error: "Çok fazla kod talebi. Lütfen biraz bekleyin." },
        { status: 429 }
      );
    }

    // Email bazli limitin farkli adreslerle asilmasini engelle
    if (ipAddress !== "unknown") {
      const recentFromIp = await prisma.loginCode.count({
        where: {
          ipAddress,
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
      });

      if (recentFromIp >= 10) {
        return NextResponse.json(
          { error: "Çok fazla kod talebi. Lütfen biraz bekleyin." },
          { status: 429 }
        );
      }
    }

    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { email: normalizedEmail },
      });
      await prisma.userSettings.create({
        data: { userId: user.id },
      });
    }

    // Admin users use password login
    if (user.role === "admin") {
      return NextResponse.json(
        { error: "Admin kullanıcılar şifre ile giriş yapar" },
        { status: 400 }
      );
    }

    const code = generateCode();
    const codeHash = await bcryptjs.hash(code, 10);

    await prisma.loginCode.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        ipAddress,
      },
    });

    await sendLoginCode(normalizedEmail, code);

    return NextResponse.json({ message: "Doğrulama kodu gönderildi", email: normalizedEmail });
  } catch (error) {
    console.error("Request code error:", error);
    return NextResponse.json(
      { error: "Kod gönderilirken hata oluştu" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getMailTransporter } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId || session.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  try {
    const { to } = await req.json();
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "default" },
    });

    const transporter = await getMailTransporter();

    await transporter.sendMail({
      from: `"${settings?.smtpFromName || "Not Al"}" <${settings?.smtpFromEmail || settings?.smtpUsername}>`,
      to: to || session.email,
      subject: "Not Al - Test Email",
      html: `<p>Bu bir test emailidir. SMTP ayarlarınız doğru çalışıyor! ✓</p>`,
    });

    return NextResponse.json({ message: "Test emaili gönderildi" });
  } catch (error) {
    console.error("Test email error:", error);
    return NextResponse.json(
      { error: `Email gönderilemedi: ${error instanceof Error ? error.message : "Bilinmeyen hata"}` },
      { status: 500 }
    );
  }
}

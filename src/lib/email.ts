import nodemailer from "nodemailer";
import { prisma } from "./prisma";

export async function getMailTransporter() {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings?.smtpHost || !settings?.smtpUsername) {
    throw new Error("SMTP ayarları yapılandırılmamış");
  }

  const port = settings.smtpPort || 587;
  // Port 465 = implicit SSL, Port 587 = STARTTLS (secure must be false)
  const secure = port === 465;

  return nodemailer.createTransport({
    host: settings.smtpHost,
    port,
    secure,
    auth: {
      user: settings.smtpUsername,
      pass: settings.smtpPasswordEncrypted || "",
    },
    ...(!secure ? { tls: { rejectUnauthorized: false } } : {}),
  });
}

export async function sendLoginCode(email: string, code: string) {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: "default" },
  });

  const transporter = await getMailTransporter();

  await transporter.sendMail({
    from: `"${settings?.smtpFromName || "Not Al"}" <${settings?.smtpFromEmail || settings?.smtpUsername}>`,
    to: email,
    subject: "Not Al - Giriş Kodu",
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a1a;">Not Al</h2>
        <p>Giriş kodunuz:</p>
        <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #18181b;">${code}</span>
        </div>
        <p style="color: #71717a; font-size: 14px;">Bu kod 5 dakika içinde geçerliliğini yitirecektir.</p>
      </div>
    `,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getNoteQueue } from "@/lib/queue";

const ACTIONS = ["summarize", "translate", "categorize", "transcribe"] as const;
type Action = (typeof ACTIONS)[number];

const STATUS_FOR: Record<Action, string> = {
  summarize: "summarizing",
  translate: "translating",
  categorize: "categorizing",
  transcribe: "downloading",
};

/** Video hatti ayri bir is turu; digerleri tek AI adimi olarak calisiyor. */
const JOB_FOR: Record<Action, string> = {
  summarize: "enrich-note",
  translate: "enrich-note",
  categorize: "enrich-note",
  transcribe: "transcribe-note",
};

/**
 * Tek bir AI adimini talep uzerine kuyruga alir. Otomatik isleme kapali;
 * kullanici hangi notta ne istedigine kendisi karar veriyor.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { id } = await params;
  const { action } = await req.json();

  if (!ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `Geçersiz işlem. Beklenen: ${ACTIONS.join(", ")}` },
      { status: 400 }
    );
  }

  const note = await prisma.note.findFirst({
    where: { id, userId: session.userId },
  });

  if (!note) {
    return NextResponse.json({ error: "Not bulunamadı" }, { status: 404 });
  }

  // Anahtar yoksa isi hic baslatma: aksi halde not "isleniyor" durumunda
  // takilip kaliyor ve kullanici bekledigini saniyor
  const [userSettings, systemSettings] = await Promise.all([
    prisma.userSettings.findUnique({
      where: { userId: session.userId },
      select: { openaiApiKeyEncrypted: true },
    }),
    prisma.systemSettings.findUnique({
      where: { id: "default" },
      select: { openaiApiKey: true },
    }),
  ]);

  if (!userSettings?.openaiApiKeyEncrypted && !systemSettings?.openaiApiKey) {
    return NextResponse.json(
      {
        error:
          "OpenAI API anahtarı tanımlı değil. Ayarlar sayfasından ekledikten sonra tekrar deneyin.",
      },
      { status: 400 }
    );
  }

  // Durumu hemen guncelle ki arayuz beklemeye gectigini gosterebilsin
  await prisma.note.update({
    where: { id },
    data: { status: STATUS_FOR[action as Action], errorText: null },
  });

  try {
    await getNoteQueue().add(
      JOB_FOR[action as Action],
      { noteId: id, userId: session.userId, action },
      { jobId: `enrich-${id}-${action}-${Date.now()}` }
    );
  } catch (queueError) {
    console.error("Queue error:", queueError);
    await prisma.note.update({
      where: { id },
      data: { status: "ready" },
    });
    return NextResponse.json(
      { error: "İşlem kuyruğa alınamadı" },
      { status: 503 }
    );
  }

  return NextResponse.json({ message: "İşlem başlatıldı", action });
}

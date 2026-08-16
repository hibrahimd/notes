import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { rm, stat } from "fs/promises";
import { Readable } from "stream";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getStoragePath } from "@/lib/storage";

/**
 * Not medyasini (video, altyazi) yalnizca sahibine sunar.
 *
 * Dosyalar depolama biriminde duruyor ve web sunucusundan dogrudan
 * erisilebilir degil; her istek oturum ve not sahipligi ile dogrulanir.
 * Video icin Range destegi var, yoksa oynaticida ileri sarma calismaz.
 */
/** Medya kaydini sahiplik kontroluyle bulup guvenli dosya yolunu dondurur. */
async function resolveMedia(
  userId: string,
  noteId: string,
  mediaId: string
): Promise<{ media: { storagePath: string; mimeType: string | null }; filePath: string } | null> {
  const media = await prisma.noteMedia.findFirst({
    where: { id: mediaId, noteId, note: { userId } },
  });

  if (!media) return null;

  // Depolama kokunun disina cikan bir yol kabul edilmez
  const root = path.resolve(getStoragePath());
  const filePath = path.resolve(root, media.storagePath);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    return null;
  }

  return { media, filePath };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { id, mediaId } = await params;
  const resolved = await resolveMedia(session.userId, id, mediaId);

  if (!resolved) {
    return NextResponse.json({ error: "Medya bulunamadı" }, { status: 404 });
  }

  const { media, filePath } = resolved;

  let info;
  try {
    info = await stat(filePath);
  } catch {
    return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 404 });
  }

  const contentType = media.mimeType || "application/octet-stream";
  const range = req.headers.get("range");

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : info.size - 1;

      if (start >= info.size || end >= info.size || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${info.size}` },
        });
      }

      const stream = Readable.toWeb(
        createReadStream(filePath, { start, end })
      ) as ReadableStream;

      return new NextResponse(stream, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${info.size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, no-store",
        },
      });
    }
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(info.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * Tek bir medya dosyasini siler. Videoyu izledikten sonra diskten kaldirmak
 * icin: transkript ve altyazilar veritabaninda kaldigi icin not islevsel
 * kalmaya devam eder.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { id, mediaId } = await params;
  const resolved = await resolveMedia(session.userId, id, mediaId);

  if (!resolved) {
    return NextResponse.json({ error: "Medya bulunamadı" }, { status: 404 });
  }

  await rm(resolved.filePath, { force: true }).catch((error) =>
    console.error("Medya dosyası silinemedi:", error)
  );
  await prisma.noteMedia.delete({ where: { id: mediaId } });

  return NextResponse.json({ message: "Medya silindi" });
}

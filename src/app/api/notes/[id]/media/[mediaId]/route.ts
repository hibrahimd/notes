import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
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
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { id, mediaId } = await params;

  const media = await prisma.noteMedia.findFirst({
    where: { id: mediaId, noteId: id, note: { userId: session.userId } },
  });

  if (!media) {
    return NextResponse.json({ error: "Medya bulunamadı" }, { status: 404 });
  }

  // Depolama kokunun disina cikan bir yol kabul edilmez
  const root = path.resolve(getStoragePath());
  const filePath = path.resolve(root, media.storagePath);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    return NextResponse.json({ error: "Geçersiz yol" }, { status: 400 });
  }

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

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Worker'in paylasilan veritabani baglantisi ve is kaydi yardimcilari.
 * Not islemcisi ile video islemcisi ayni kayitlari tuttugu icin tek yerde.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
export const prisma = new PrismaClient({ adapter });

export async function updateStatus(noteId: string, status: string) {
  await prisma.note.update({ where: { id: noteId }, data: { status } });
}

export async function createJob(
  noteId: string,
  jobType: string,
  status: string,
  message: string
) {
  await prisma.noteJob.create({
    data: { noteId, jobType, status, message, startedAt: new Date() },
  });
}

/**
 * Yapilmayan bir adimi kullaniciya gorunur sekilde kaydeder.
 *
 * Adim baslatildiktan sonra atlanabiliyor (ornegin altyazi bulunamayip
 * konusma tanimaya duserken anahtar cikmadiginda). O durumda yeni kayit
 * acmak yerine calisan kaydi kapatiyoruz, yoksa "running" satiri sonsuza
 * kadar oyle kaliyor.
 */
export async function skipJob(noteId: string, jobType: string, message: string) {
  const running = await prisma.noteJob.findFirst({
    where: { noteId, jobType, status: "running" },
    orderBy: { startedAt: "desc" },
  });

  if (running) {
    await prisma.noteJob.update({
      where: { id: running.id },
      data: { status: "skipped", message, finishedAt: new Date() },
    });
    return;
  }

  await prisma.noteJob.create({
    data: {
      noteId,
      jobType,
      status: "skipped",
      message,
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });
}

export async function progressJob(
  noteId: string,
  jobType: string,
  message: string,
  progress: number
) {
  const job = await prisma.noteJob.findFirst({
    where: { noteId, jobType, status: "running" },
    orderBy: { startedAt: "desc" },
  });
  if (job) {
    await prisma.noteJob.update({
      where: { id: job.id },
      data: { message, progress },
    });
  }
}

export async function completeJob(
  noteId: string,
  jobType: string,
  message: string
) {
  const job = await prisma.noteJob.findFirst({
    where: { noteId, jobType, status: "running" },
    orderBy: { startedAt: "desc" },
  });
  if (job) {
    await prisma.noteJob.update({
      where: { id: job.id },
      data: { status: "completed", message, finishedAt: new Date(), progress: 100 },
    });
  }
}

export async function failJob(
  noteId: string,
  jobType: string,
  errorMessage: string
) {
  const job = await prisma.noteJob.findFirst({
    where: { noteId, jobType, status: "running" },
    orderBy: { startedAt: "desc" },
  });
  if (job) {
    await prisma.noteJob.update({
      where: { id: job.id },
      data: { status: "failed", errorText: errorMessage, finishedAt: new Date() },
    });
  }
}

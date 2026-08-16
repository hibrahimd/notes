import { prisma } from "../src/lib/prisma";
import { urlKey } from "../src/lib/url";

/**
 * Mevcut notlara karsilastirma anahtarini yazar.
 *
 * Anahtar uygulama tarafinda uretiliyor (izleme parametrelerinin listesi,
 * parametre siralamasi), bu yuzden SQL ile geri doldurulamiyor. Bir kez
 * calistirilir:
 *
 *   docker exec <app> npx tsx scripts/backfill-url-keys.ts
 */
async function main() {
  const notes = await prisma.note.findMany({
    where: { sourceUrl: { not: null }, sourceUrlKey: null },
    select: { id: true, sourceUrl: true },
  });

  console.log(`${notes.length} not güncellenecek`);

  for (const note of notes) {
    await prisma.note.update({
      where: { id: note.id },
      data: { sourceUrlKey: urlKey(note.sourceUrl!) },
    });
  }

  // Anahtari ayni olan gruplar: mevcut tekrarlar temizlenmiyor, yalnizca
  // raporlaniyor — hangisinin silinecegi kullanicinin karari
  const duplicates = await prisma.note.groupBy({
    by: ["userId", "sourceUrlKey"],
    where: { sourceUrlKey: { not: null } },
    _count: true,
    having: { sourceUrlKey: { _count: { gt: 1 } } },
  });

  console.log(`Tamamlandı. Mevcut tekrar eden grup: ${duplicates.length}`);
  for (const group of duplicates) {
    console.log(`  ${group._count}x ${group.sourceUrlKey}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

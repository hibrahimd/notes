import { createWriteStream } from "fs";
import { mkdir, readdir, readFile, rm, stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { deflateRaw } from "zlib";
import { promisify } from "util";

/**
 * Eklentiyi AMO'ya yuklenebilir bir zip'e paketler.
 *
 * Bagimlilik eklememek icin zip elle yaziliyor: paketin tek ihtiyaci
 * "deflate" ve zlib zaten Node ile geliyor. AMO paketi klasor icine
 * gomulmus kabul etmedigi icin dosyalar zip kokune yaziliyor.
 */

const deflate = promisify(deflateRaw);
const here = path.dirname(fileURLToPath(import.meta.url));

const SOURCE_DIR = path.join(here, "firefox");
const OUTPUT_DIR = path.join(here, "dist");

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

async function collect(dir, prefix = "") {
  const files = [];

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) files.push(...(await collect(full, name)));
    else files.push({ name, data: await readFile(full) });
  }

  return files;
}

async function main() {
  const manifest = JSON.parse(
    await readFile(path.join(SOURCE_DIR, "manifest.json"), "utf-8")
  );

  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  const outputPath = path.join(
    OUTPUT_DIR,
    `notal-firefox-${manifest.version}.zip`
  );

  const files = await collect(SOURCE_DIR);
  const output = createWriteStream(outputPath);
  const central = [];
  let offset = 0;

  const write = (chunk) =>
    new Promise((resolve, reject) =>
      output.write(chunk, (err) => (err ? reject(err) : resolve()))
    );

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, "utf-8");
    const compressed = await deflate(file.data);
    const checksum = crc32(file.data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // gerekli surum
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 dosya adi
    localHeader.writeUInt16LE(8, 8); // deflate
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(file.data.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);

    await write(localHeader);
    await write(nameBytes);
    await write(compressed);

    central.push({
      nameBytes,
      checksum,
      compressedSize: compressed.length,
      size: file.data.length,
      offset,
    });

    offset += localHeader.length + nameBytes.length + compressed.length;
  }

  const centralStart = offset;

  for (const entry of central) {
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4); // uretici surum
    header.writeUInt16LE(20, 6); // gerekli surum
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(8, 10);
    header.writeUInt32LE(entry.checksum, 16);
    header.writeUInt32LE(entry.compressedSize, 20);
    header.writeUInt32LE(entry.size, 24);
    header.writeUInt16LE(entry.nameBytes.length, 28);
    header.writeUInt32LE(entry.offset, 42);

    await write(header);
    await write(entry.nameBytes);

    offset += header.length + entry.nameBytes.length;
  }

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(offset - centralStart, 12);
  end.writeUInt32LE(centralStart, 16);

  await write(end);

  await new Promise((resolve, reject) =>
    output.end((err) => (err ? reject(err) : resolve()))
  );

  const info = await stat(outputPath);
  console.log(
    `${path.relative(process.cwd(), outputPath)} — ${files.length} dosya, ${(
      info.size / 1024
    ).toFixed(1)} KB`
  );
  for (const file of files) console.log(`  ${file.name}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "assets", "icons");

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function insideRoundedRect(x, y, size, radius) {
  const cx = Math.max(radius, Math.min(size - radius - 1, x));
  const cy = Math.max(radius, Math.min(size - radius - 1, y));
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function makeIcon(size) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  const radius = size * 0.23;
  const bars = [0.34, 0.59, 0.43];
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    pixels[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const index = row + 1 + x * 4;
      const visible = insideRoundedRect(x, y, size, radius);
      const blend = (x + y) / (size * 2);
      let rgba = visible ? [Math.round(104 + 39 * blend), Math.round(82 + 24 * blend), 255, 255] : [0, 0, 0, 0];
      for (let bar = 0; bar < 3; bar += 1) {
        const center = size * (0.29 + bar * 0.21);
        const halfWidth = Math.max(1, size * 0.035);
        const halfHeight = size * bars[bar] / 2;
        if (Math.abs(x - center) <= halfWidth && Math.abs(y - size / 2) <= halfHeight) rgba = [255, 255, 255, 245];
      }
      pixels.set(rgba, index);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

await mkdir(output, { recursive: true });
for (const size of [16, 32, 48, 128]) await writeFile(path.join(output, `icon-${size}.png`), makeIcon(size));
console.log("Generated TabMixer icons.");

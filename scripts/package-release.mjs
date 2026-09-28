import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const releaseDir = path.join(root, "release");
const output = path.join(releaseDir, `tabmixer-v${manifest.version}.zip`);
const include = ["manifest.json", "src", "assets"];
const entries = [];

async function collect(target, archivePath) {
  const items = await readdir(target, { withFileTypes: true });
  for (const item of items) {
    const diskPath = path.join(target, item.name);
    const zipPath = path.posix.join(archivePath, item.name);
    if (item.isDirectory()) await collect(diskPath, zipPath);
    else entries.push({ name: zipPath, data: await readFile(diskPath) });
  }
}

for (const item of include) {
  const target = path.join(root, item);
  if (item.endsWith(".json")) entries.push({ name: item, data: await readFile(target) });
  else await collect(target, item);
}

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
function dosTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

const localParts = [];
const centralParts = [];
let offset = 0;
for (const entry of entries) {
  const name = Buffer.from(entry.name.replaceAll("\\", "/"));
  const crc = crc32(entry.data);
  const { time, day } = dosTime();
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8); local.writeUInt16LE(time, 10); local.writeUInt16LE(day, 12);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(entry.data.length, 18); local.writeUInt32LE(entry.data.length, 22);
  local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
  localParts.push(local, name, entry.data);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8); central.writeUInt16LE(0, 10); central.writeUInt16LE(time, 12); central.writeUInt16LE(day, 14);
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(entry.data.length, 20); central.writeUInt32LE(entry.data.length, 24);
  central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
  centralParts.push(central, name);
  offset += local.length + name.length + entry.data.length;
}
const central = Buffer.concat(centralParts);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
await mkdir(releaseDir, { recursive: true });
await rm(output, { force: true });
await writeFile(output, Buffer.concat([...localParts, central, end]));
console.log(`Created ${path.relative(root, output)} with ${entries.length} files.`);

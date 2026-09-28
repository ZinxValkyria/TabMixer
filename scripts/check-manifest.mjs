import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const errors = [];

if (manifest.manifest_version !== 3) errors.push("manifest_version must be 3");
if (!/^\d+\.\d+\.\d+(\.\d+)?$/.test(manifest.version)) errors.push("version is not store-compatible");
if (manifest.host_permissions?.length) errors.push("v1 must not request host permissions");
const allowed = new Set(["tabs", "tabCapture", "offscreen", "storage"]);
for (const permission of manifest.permissions || []) {
  if (!allowed.has(permission)) errors.push(`unexpected permission: ${permission}`);
}

const files = [
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  ...Object.values(manifest.icons || {}),
  ...Object.values(manifest.action?.default_icon || {}),
].filter(Boolean);
for (const file of new Set(files)) {
  try { await access(path.join(root, file)); }
  catch { errors.push(`missing manifest asset: ${file}`); }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Manifest ${manifest.version} is valid and references existing assets.`);
}

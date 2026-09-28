import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignored = new Set(["node_modules", "release"]);
const files = [];

function walk(folder) {
  for (const name of readdirSync(folder)) {
    if (ignored.has(name)) continue;
    const target = path.join(folder, name);
    if (statSync(target).isDirectory()) walk(target);
    else if (target.endsWith(".js") || target.endsWith(".mjs")) files.push(target);
  }
}

walk(root);
for (const file of files) execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
console.log(`Syntax checked ${files.length} JavaScript files.`);

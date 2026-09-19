import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const roots = ["backend", "simulator"];
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && full.endsWith(".mjs")) files.push(full);
  }
}

for (const root of roots) walk(root);
for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntax check passed for ${files.length} Node.js files.`);

import { mkdir, copyFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
await mkdir("frontend/vendor", { recursive: true });
await copyFile("node_modules/d3/dist/d3.min.js", "frontend/vendor/d3.min.js");
await copyFile("node_modules/d3/LICENSE", "frontend/vendor/D3-LICENSE.txt");
execFileSync(
  process.execPath,
  [
    "node_modules/tailwindcss/lib/cli.js",
    "-i",
    "frontend/css/input.css",
    "-o",
    "frontend/css/styles.css",
    "--minify",
  ],
  { stdio: "inherit" },
);
console.log("TailwindCSS dan D3 lokal siap; browser tidak memerlukan CDN.");

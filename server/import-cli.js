import { access } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pool } from "./db.js";
import { importDataset } from "./importer.js";

const requested = resolve(
  process.env.DATASET_PATH || "data/epl-goalScorer20-21in.csv",
);
let path = requested;
let mode = "original";
try {
  await access(path);
} catch {
  if (process.env.ALLOW_DEMO === "false") {
    console.error(
      `CSV asli belum tersedia: ${path}. Salin dataset ke folder data/.`,
    );
    await pool.end();
    process.exit(1);
  }
  path = resolve("data/demo-synthetic.csv");
  mode = "demo";
  console.warn(
    "CSV asli belum tersedia. Demo sintetis dipakai hanya jika belum ada dataset asli tersimpan.",
  );
}
let client;
try {
  client = await pool.connect();
  let keepOriginal = false;
  if (mode === "demo") {
    const table = await client.query(
      "SELECT to_regclass('public.dataset_meta') AS relation",
    );
    if (table.rows[0].relation) {
      const current = await client.query(
        "SELECT mode FROM dataset_meta WHERE singleton = TRUE",
      );
      keepOriginal = current.rows[0]?.mode === "original";
    }
  }
  if (keepOriginal)
    console.log(
      "CSV asli tidak ada di folder data; dataset asli yang sudah tersimpan tetap digunakan. Demo tidak menimpanya.",
    );
  else {
    const result = await importDataset(client, {
      path,
      filename: basename(path),
      mode,
      force: process.argv.includes("--force"),
    });
    console.log(
      JSON.stringify({ ...result, filename: basename(path) }, null, 2),
    );
  }
} catch (error) {
  console.error(`Impor gagal: ${error.message}`);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}

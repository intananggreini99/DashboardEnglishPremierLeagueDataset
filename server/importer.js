import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";

export const FIELDS = [
  "id",
  "player_name",
  "games",
  "time",
  "goals",
  "xg",
  "assists",
  "xa",
  "shots",
  "key_passes",
  "yellow_cards",
  "red_cards",
  "position",
  "team_title",
  "npg",
  "npxg",
  "xgchain",
  "xgbuildup",
];
const TEXT = new Set(["player_name", "position", "team_title"]);
const FLOAT = new Set(["xg", "xa", "npxg", "xgchain", "xgbuildup"]);

/** Strict validation: fail the whole import instead of silently replacing missing values. */
export function parseDataset(input) {
  let headers;
  const raw = parse(input, {
    bom: true,
    trim: true,
    skip_empty_lines: true,
    columns: (columns) => {
      headers = columns.map((c) => c.trim().toLowerCase());
      const kept = headers.filter((h) => h && !/^unnamed:/.test(h));
      if (new Set(kept).size !== kept.length)
        throw new Error("Header CSV duplikat.");
      const missing = FIELDS.filter((f) => !headers.includes(f));
      if (missing.length)
        throw new Error(`Kolom CSV belum lengkap: ${missing.join(", ")}`);
      return headers;
    },
  });
  if (!raw.length) throw new Error("CSV kosong atau hanya berisi header.");
  const ids = new Set();
  const players = raw.map((record, i) => {
    const p = {};
    const invalid = (message) => {
      throw new Error(`Baris data ${i + 1}: ${message}`);
    };
    for (const f of FIELDS) {
      const v = record[f];
      if (v === undefined || v.trim() === "") invalid(`${f} kosong.`);
      if (TEXT.has(f)) {
        if (v.length > 240) invalid(`${f} terlalu panjang.`);
        p[f] = v;
      } else {
        const value = Number(v);
        if (
          !Number.isFinite(value) ||
          value < 0 ||
          (!FLOAT.has(f) && !Number.isSafeInteger(value))
        )
          invalid(`${f} harus angka nonnegatif yang valid.`);
        p[f] = value;
      }
    }
    p.position = p.position.split(/\s+/).join(" ");
    if (
      p.position.split(" ").some((v) => !["GK", "F", "M", "D", "S"].includes(v))
    )
      invalid("kode posisi harus GK/F/M/D/S.");
    p.team_title = p.team_title
      .split(",")
      .map((x) => x.trim())
      .join(",");
    if (p.team_title.split(",").some((v) => !v)) invalid("nama klub kosong.");
    if (!p.id || ids.has(p.id))
      invalid("id harus unik dan lebih besar dari nol.");
    ids.add(p.id);
    if (p.npg > p.goals) invalid("npg melebihi goals.");
    if (p.npxg > p.xg + 1e-6) invalid("npxG melebihi xG.");
    if (p.goals > p.shots) invalid("goals melebihi shots.");
    if (p.games > 100) invalid("games di luar rentang musiman.");
    if (
      p.time === 0 &&
      [
        "goals",
        "assists",
        "shots",
        "key_passes",
        "yellow_cards",
        "red_cards",
        "xg",
        "xa",
        "xgchain",
        "xgbuildup",
      ].some((f) => p[f] > 0)
    )
      invalid("statistik positif dengan menit bermain nol.");
    return p;
  });
  return players;
}

export async function importDataset(
  db,
  { path, filename, mode = "original", force = false },
) {
  if (!["demo", "original"].includes(mode))
    throw new Error("Mode dataset tidak valid.");
  const bytes = await readFile(path);
  const players = parseDataset(bytes);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const schema = await readFile(
    new URL("../sql/001_schema.sql", import.meta.url),
    "utf8",
  );
  // One dedicated client must own BEGIN/COMMIT (never spread a transaction across a pool).
  await db.query("BEGIN");
  try {
    await db.query(schema);
    const previous = await db.query(
      "SELECT checksum, mode FROM dataset_meta WHERE singleton = TRUE",
    );
    if (
      !force &&
      previous.rows[0]?.checksum === checksum &&
      previous.rows[0]?.mode === mode
    ) {
      await db.query("COMMIT");
      return { skipped: true, count: players.length, checksum, mode };
    }
    await db.query("DELETE FROM players");
    const placeholders = FIELDS.map((_, i) => `$${i + 1}`).join(",");
    for (const p of players)
      await db.query(
        `INSERT INTO players (${FIELDS.join(",")}) VALUES (${placeholders})`,
        FIELDS.map((f) => p[f]),
      );
    await db.query(
      `INSERT INTO dataset_meta(singleton, filename, checksum, mode, row_count)
      VALUES(TRUE, $1, $2, $3, $4) ON CONFLICT(singleton) DO UPDATE SET
      filename=EXCLUDED.filename, checksum=EXCLUDED.checksum, mode=EXCLUDED.mode,
      row_count=EXCLUDED.row_count, imported_at=now()`,
      [filename, checksum, mode, players.length],
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
  return { skipped: false, count: players.length, checksum, mode };
}

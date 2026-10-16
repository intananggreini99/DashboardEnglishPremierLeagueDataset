import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { importDataset, parseDataset } from "../server/importer.js";
import { createApp } from "../server/app.js";

const file = new URL("../data/demo-synthetic.csv", import.meta.url);
function adapter(engine) {
  return {
    query: async (sql, params) => {
      if (sql.includes("CREATE TABLE IF NOT EXISTS players")) {
        const results = await engine.exec(sql);
        return results.at(-1);
      }
      return engine.query(sql, params);
    },
  };
}

test("CSV strict validation accepts UTF-8, pandas index, quoted multi-club names and rejects silent corruption", async () => {
  const text = await readFile(file, "utf8");
  const rows = parseDataset("\uFEFF" + text);
  assert.equal(rows.length, 124);
  assert.equal(rows.filter((p) => p.team_title.includes(",")).length, 4);
  assert.throws(
    () => parseDataset(text.replace('"xG"', '"missing_xg"')),
    /Kolom CSV/,
  );
  assert.throws(
    () => parseDataset(text.replace('"Arka Demo 001"', '""')),
    /player_name kosong/,
  );
  const lines = text.trim().split("\n");
  assert.throws(
    () => parseDataset([...lines, lines[1]].join("\n")),
    /id harus unik/,
  );
  const fields = lines[1].split(",");
  fields[6] = '"NaN"';
  assert.throws(
    () => parseDataset([lines[0], fields.join(",")].join("\n")),
    /xg harus angka/,
  );
});

test("PostgreSQL engine: import, SQL views, transfer policy, idempotence and atomic rollback", async () => {
  const pg = new PGlite();
  const db = adapter(pg);
  const temp = await mkdtemp(join(tmpdir(), "epl-import-"));
  try {
    const first = await importDataset(db, {
      path: file,
      filename: "demo-synthetic.csv",
      mode: "demo",
    });
    assert.equal(first.count, 124);
    assert.equal(first.skipped, false);
    const second = await importDataset(db, {
      path: file,
      filename: "demo-synthetic.csv",
      mode: "demo",
    });
    assert.equal(second.skipped, true);
    const players = await db.query("SELECT * FROM player_metrics");
    const clubs = await db.query("SELECT * FROM club_metrics");
    assert.equal(clubs.rows.length, 20);
    assert.equal(
      clubs.rows.reduce((t, c) => t + c.player_count, 0),
      120,
    );
    assert.equal(players.rows.filter((p) => p.is_transfer).length, 4);
    assert.ok(
      Math.abs(
        players.rows.reduce((t, p) => t + p.penalty_attempts_est, 0) -
          players.rows.reduce((t, p) => t + (p.xg - p.npxg) / 0.76, 0),
      ) < 1e-8,
    );
    const before = await db.query("SELECT * FROM dataset_meta");
    let insert = 0;
    const broken = {
      query: async (sql, params) => {
        if (sql.startsWith("INSERT INTO players") && ++insert === 2) {
          const altered = [...params];
          altered[4] = 9999;
          return db.query(sql, altered);
        }
        return db.query(sql, params);
      },
    };
    await assert.rejects(
      () =>
        importDataset(broken, {
          path: file,
          filename: "broken.csv",
          mode: "demo",
          force: true,
        }),
      /check constraint/,
    );
    assert.equal(
      (await db.query("SELECT count(*)::integer AS n FROM players")).rows[0].n,
      124,
    );
    assert.equal(
      (await db.query("SELECT checksum FROM dataset_meta")).rows[0].checksum,
      before.rows[0].checksum,
    );
    const invalid = join(temp, "invalid.csv");
    await writeFile(invalid, "id,player_name\n1,Invalid");
    await assert.rejects(
      () => importDataset(db, { path: invalid, filename: "invalid.csv" }),
      /Kolom CSV/,
    );
    assert.equal(
      (await db.query("SELECT count(*)::integer AS n FROM players")).rows[0].n,
      124,
    );
    // Different metadata mode with the same bytes must not incorrectly skip the replacement.
    const relabeled = await importDataset(db, {
      path: file,
      filename: "test-original.csv",
      mode: "original",
    });
    assert.equal(relabeled.skipped, false);
    assert.equal(
      (await db.query("SELECT mode FROM dataset_meta")).rows[0].mode,
      "original",
    );
  } finally {
    await pg.close();
    await rm(temp, { recursive: true, force: true });
  }
});

test("API returns database rows, consistent dataset metadata, health and unavailable states", async () => {
  const pg = new PGlite();
  const db = adapter(pg);
  await importDataset(db, {
    path: file,
    filename: "demo-synthetic.csv",
    mode: "demo",
  });
  const app = createApp(db);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(base + "/api/health");
    assert.equal(health.status, 200);
    assert.equal((await health.json()).row_count, 124);
    const response = await fetch(base + "/api/data");
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.meta.mode, "demo");
    assert.equal(json.players.length, 124);
    assert.equal(typeof json.players[0].xg, "number");
    assert.equal(json.meta.club_policy, "exclude_multi_club");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await fetch(base + "/api/unknown")).status, 404);
    await db.query("DELETE FROM dataset_meta");
    assert.equal((await fetch(base + "/api/health")).status, 503);
    assert.equal((await fetch(base + "/api/data")).status, 503);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pg.close();
  }
});

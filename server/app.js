import express from "express";

export function createApp(db) {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Cache-Control", "no-store");
    next();
  });
  app.get("/api/health", async (_req, res) => {
    try {
      await db.query("SELECT 1");
      const r = await db.query(
        "SELECT row_count, mode FROM dataset_meta WHERE singleton = TRUE",
      );
      if (!r.rows.length)
        return res.status(503).json({ error: "Dataset belum diimpor." });
      res.json({ status: "ok", database: "PostgreSQL", ...r.rows[0] });
    } catch {
      res.status(503).json({ error: "Database belum siap." });
    }
  });
  app.get("/api/data", async (_req, res, next) => {
    const client = typeof db.connect === "function" ? await db.connect() : db;
    try {
      // Metadata and rows are one consistent snapshot even if an administrator reimports.
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const meta = await client.query(
        "SELECT filename, checksum, mode, row_count, imported_at FROM dataset_meta WHERE singleton = TRUE",
      );
      const players = await client.query(
        "SELECT * FROM player_metrics ORDER BY goals DESC, assists DESC, id ASC",
      );
      await client.query("COMMIT");
      if (!meta.rows.length)
        return res.status(503).json({ error: "Dataset belum diimpor." });
      res.json({
        meta: {
          ...meta.rows[0],
          snapshot: "2021-05-23",
          season: "2020/21",
          source:
            meta.rows[0].mode === "demo"
              ? "Data sintetis untuk demonstrasi"
              : "CSV pengguna · Understat/Kaggle (sesuai rancangan)",
          club_policy: "exclude_multi_club",
          penalty_xg: 0.76,
        },
        players: players.rows,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      next(error);
    } finally {
      if (client !== db) client.release();
    }
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Endpoint tidak ditemukan." }),
  );
  app.use((error, _req, res, _next) => {
    console.error("API:", error.message);
    res
      .status(503)
      .json({
        error: "Data belum dapat dimuat. Periksa layanan database dan impor.",
      });
  });
  return app;
}

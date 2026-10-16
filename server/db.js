import pg from "pg";

export const pool = new pg.Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "epl_dashboard",
  user: process.env.PGUSER || "epl",
  password: process.env.PGPASSWORD || "epl_local_dev",
  max: 5,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});
pool.on("error", (error) => console.error("PostgreSQL pool:", error.message));

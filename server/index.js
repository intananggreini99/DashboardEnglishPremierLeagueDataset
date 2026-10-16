import { createApp } from "./app.js";
import { pool } from "./db.js";

const server = createApp(pool).listen(
  Number(process.env.PORT || 3000),
  "0.0.0.0",
  () => console.log("EPL API siap di port 3000"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  });

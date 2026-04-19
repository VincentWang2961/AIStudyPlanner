import * as fs from "fs";
import * as path from "path";
import { pool } from "../config/db";

async function run() {
  const test = await pool.query("SELECT current_database(), current_user");
  console.log(test.rows);

  const schemaPath = path.join(__dirname, "../config/schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf-8");

  await pool.query(sql);
  console.log("✅ Database schema initialized");
  await pool.end();
}

run().catch((err) => {
  console.error("❌ Failed to initialize DB");
  console.error(err);
  process.exit(1);
});
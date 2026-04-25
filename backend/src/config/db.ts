import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();
console.log("DATABASE_URL =", process.env.DATABASE_URL);

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in .env");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function testDbConnection() {
  try {
    const client = await pool.connect();

    const result = await client.query("SELECT NOW()");

    console.log("Database connected successfully.");

    console.log("Database time:", result.rows[0]);

    client.release();
  } catch (error) {
    console.error("Database connection failed:", error);
  }
}

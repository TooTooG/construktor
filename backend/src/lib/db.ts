import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

export function getDb() {
  return pool;
}

export async function pingDb() {
  await pool.query("select 1");
}

export async function closeDb() {
  await pool.end();
}

// Creates the tables in your Neon database.
// Run once:  npm run db:setup   (reads DATABASE_URL from .env.local)

import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
import { loadEnvFile } from "./env.js";

loadEnvFile();
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Add it to .env.local first.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const schema = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

// Run each statement separately (the HTTP driver sends one statement at a time)
const statements = schema
  .split(";")
  .map((s) => s.replace(/--.*$/gm, "").trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
}
console.log(`Database ready: ${statements.length} statements applied.`);

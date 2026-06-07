import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env["TURSO_URL"] ?? "",
  authToken: process.env["TURSO_AUTH_TOKEN"] ?? "",
});

const result = await client.execute("SELECT * FROM readings ORDER BY timestamp DESC LIMIT 20");
console.table(result.rows);

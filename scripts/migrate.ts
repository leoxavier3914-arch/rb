import fs from "node:fs";
import path from "node:path";

import { supabaseAdmin } from "@/lib/supabase";

async function runMigrations() {
  const schemaDir = path.resolve(process.cwd(), "schema");
  const files = fs
    .readdirSync(schemaDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(schemaDir, file), "utf8");
    const { error } = await supabaseAdmin.rpc("pg_execute_sql", { query: sql });
    if (error) {
      throw new Error(`Falha ao executar ${file}: ${error.message}`);
    }
    console.log(`✔ Executado ${file}`);
  }
}

runMigrations().catch((error) => {
  console.error(error);
  process.exit(1);
});

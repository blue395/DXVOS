import "dotenv/config";
import { defineConfig } from "prisma/config";

// The Prisma CLI (migrations) needs a DIRECT database connection. In production
// that's DIRECT_URL (Supabase port 5432); the running app uses the pooled
// DATABASE_URL instead (see src/lib/db.ts). Locally one URL does both.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});

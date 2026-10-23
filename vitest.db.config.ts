import { defineConfig } from "vitest/config";
import path from "node:path";

// Database tests (npm run test:db): run against a throwaway database made fresh by
// scripts/test-db.sh, with synthetic data only. Never point this at a real database.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
    },
  },
  test: { include: ["src/**/*.dbtest.ts"], fileParallelism: false, testTimeout: 30_000 },
});

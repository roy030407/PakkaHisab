// FILE: prisma.config.ts
// WHAT THIS DOES: Prisma 7 configuration.
//   Loads .env.local (gitignored) so real DATABASE_URL is never committed.
//   Use the session pooler URL (port 5432) from .env.local for migrations.
// CHANGES THIS SESSION:
//   - Switched dotenv to load .env.local instead of .env
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"],
  },
});

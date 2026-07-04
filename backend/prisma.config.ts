import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    directory: "./prisma/migrations",
    seed: "ts-node --esm ./prisma/seed.ts",
  },
  datasource: {
    url: "file:./dev.db",
  },
});

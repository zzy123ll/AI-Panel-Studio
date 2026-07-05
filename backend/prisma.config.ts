import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    directory: "./prisma/migrations",
    seed: "tsx ./prisma/seed.ts",
  },
  datasource: {
    url: "file:./dev.db",
  },
});

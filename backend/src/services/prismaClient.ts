import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: "file:./dev.db" });

/** Shared singleton — reuse across the entire server process. */
export const prisma = new PrismaClient({ adapter });

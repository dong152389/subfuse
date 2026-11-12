import "dotenv/config";
import { defineConfig } from "prisma/config";

const datasourceUrl =
  process.env.DATABASE_URL?.trim() || "postgresql://subfuse_local_dev:subfuse_local_dev_password@localhost:5432/subfuse_local_dev?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: datasourceUrl,
  },
});

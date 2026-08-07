import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/lib/db/localSchema.ts",
	out: "./drizzle",
	dialect: "sqlite",
});

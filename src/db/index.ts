import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as clipsSchema from "./schema/clips";
import * as analyticsSchema from "./schema/analytics";

const schema = { ...clipsSchema, ...analyticsSchema };

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url && process.env.NODE_ENV === "production") {
  throw new Error("TURSO_DATABASE_URL is not set");
}

export const client = createClient({
  url: url || "file:local.db",
  authToken: authToken,
});

export const db = drizzle(client, { schema });

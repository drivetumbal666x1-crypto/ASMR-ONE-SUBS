import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const cachedPages = pgTable("cached_pages", {
  key: text("key").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

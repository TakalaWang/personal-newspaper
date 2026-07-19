import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable(
  "profiles",
  {
    id: integer("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    masthead: text("masthead").notNull(),
    language: text("language").notNull(),
    timezone: text("timezone").notNull(),
    publicationTime: text("publication_time").notNull(),
    preferences: text("preferences").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [check("profiles_single_owner", sql`${table.id} = 1`)],
);

export const editions = sqliteTable("editions", {
  id: text("id").primaryKey(),
  localDate: text("local_date").notNull(),
  bundleKey: text("bundle_key").notNull(),
  manifest: text("manifest").notNull(),
  status: text("status").notNull(),
  isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(false),
  publishedAt: integer("published_at", { mode: "timestamp_ms" }).notNull(),
});

export const reactions = sqliteTable("reactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  editionId: text("edition_id")
    .notNull()
    .references(() => editions.id),
  storyId: text("story_id").notNull(),
  action: text("action").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
});

export const shares = sqliteTable("shares", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenHash: text("token_hash").notNull().unique(),
  editionId: text("edition_id")
    .notNull()
    .references(() => editions.id),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
});

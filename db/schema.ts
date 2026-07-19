import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export const agentState = sqliteTable(
  "agent_state",
  {
    id: integer("id").primaryKey(),
    revision: integer("revision").notNull().default(0),
  },
  (table) => [check("agent_state_singleton", sql`${table.id} = 1`)],
);

export const editions = sqliteTable(
  "editions",
  {
    id: text("id").primaryKey(),
    localDate: text("local_date").notNull(),
    bundleKey: text("bundle_key").notNull(),
    manifest: text("manifest").notNull(),
    status: text("status").notNull(),
    isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(false),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }).notNull(),
    contextRevision: integer("context_revision").notNull().default(0),
  },
  (table) => [uniqueIndex("editions_one_current").on(table.isCurrent).where(sql`${table.isCurrent} = 1`)],
);

export const reactions = sqliteTable(
  "reactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    editionId: text("edition_id")
      .notNull()
      .references(() => editions.id),
    storyId: text("story_id").notNull(),
    action: text("action").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
    consumedByEditionId: text("consumed_by_edition_id").references(() => editions.id),
  },
  (table) => [uniqueIndex("reactions_one_signal_per_story").on(table.editionId, table.storyId)],
);

export const shares = sqliteTable("shares", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenHash: text("token_hash").notNull().unique(),
  editionId: text("edition_id")
    .notNull()
    .references(() => editions.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
});

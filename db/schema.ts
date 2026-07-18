import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const newsletterSubscribers = sqliteTable("newsletter_subscribers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  frequency: text("frequency").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const movieRequests = sqliteTable("movie_requests", {
  movieId: text("movie_id").primaryKey(),
  title: text("title").notNull(),
  releaseYear: text("release_year").notNull().default(""),
  votes: integer("votes").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const studioOwner = sqliteTable("studio_owner", {
  id: integer("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  claimedAt: text("claimed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  movieId: text("movie_id").notNull(),
  title: text("title").notNull(),
  releaseYear: text("release_year").notNull().default(""),
  genre: text("genre").notNull(),
  runtime: integer("runtime").notNull(),
  ratingTenths: integer("rating_tenths").notNull(),
  blurb: text("blurb").notNull(),
  reviewText: text("review_text").notNull(),
  posterKey: text("poster_key").notNull(),
  posterContentType: text("poster_content_type").notNull(),
  createdBy: text("created_by").notNull(),
  publishedAt: text("published_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

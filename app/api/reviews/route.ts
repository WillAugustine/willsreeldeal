import { env } from "cloudflare:workers";

type RuntimeEnv = { DB?: D1Database };

type ReviewRow = {
  id: number;
  slug: string;
  movie_id: string;
  title: string;
  release_year: string;
  genre: string;
  runtime: number;
  rating_tenths: number;
  blurb: string;
  review_text: string;
  favorite_quote: string;
  poster_key: string;
  poster_content_type: string;
  published_at: string;
};

async function database() {
  const db = (env as unknown as RuntimeEnv).DB;
  if (!db) return null;
  await db.prepare(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    movie_id TEXT NOT NULL,
    title TEXT NOT NULL,
    release_year TEXT NOT NULL DEFAULT '',
    genre TEXT NOT NULL,
    runtime INTEGER NOT NULL,
    rating_tenths INTEGER NOT NULL,
    blurb TEXT NOT NULL,
    review_text TEXT NOT NULL,
    favorite_quote TEXT NOT NULL DEFAULT '',
    poster_key TEXT NOT NULL,
    poster_content_type TEXT NOT NULL,
    created_by TEXT NOT NULL,
    published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  const columns = await db.prepare(`PRAGMA table_info(reviews)`).all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "favorite_quote")) {
    await db.prepare(`ALTER TABLE reviews ADD COLUMN favorite_quote TEXT NOT NULL DEFAULT ''`).run();
  }
  return db;
}

function serialize(row: ReviewRow) {
  return {
    id: `review-${row.id}`,
    slug: row.slug,
    movieId: row.movie_id,
    title: row.title,
    year: row.release_year,
    genre: row.genre,
    runtime: row.runtime,
    rating: row.rating_tenths / 10,
    blurb: row.blurb,
    reviewText: row.review_text,
    favoriteQuote: row.favorite_quote,
    poster: row.poster_content_type === "external/url"
      ? row.poster_key
      : `/api/posters/${encodeURIComponent(row.poster_key)}`,
    publishedAt: row.published_at,
  };
}

export async function GET() {
  try {
    const db = await database();
    if (!db) return Response.json({ reviews: [] });
    const result = await db.prepare(`SELECT id, slug, movie_id, title, release_year, genre, runtime,
      rating_tenths, blurb, review_text, favorite_quote, poster_key, poster_content_type, published_at
      FROM reviews ORDER BY published_at DESC, id DESC LIMIT 24`).all<ReviewRow>();
    return Response.json({ reviews: result.results.map(serialize) });
  } catch {
    return Response.json({ reviews: [] });
  }
}

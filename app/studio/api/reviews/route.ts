import { env } from "cloudflare:workers";
import { getStudioOwner } from "../../../studio-auth";

type RuntimeEnv = { DB?: D1Database; POSTERS?: R2Bucket };

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
  poster_key: string;
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
    poster_key TEXT NOT NULL,
    poster_content_type TEXT NOT NULL,
    created_by TEXT NOT NULL,
    published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
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
    poster: `/api/posters/${encodeURIComponent(row.poster_key)}`,
    publishedAt: row.published_at,
  };
}

function textField(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "movie";
}

export async function POST(request: Request) {
  const owner = await getStudioOwner();
  if (!owner) return Response.json({ error: "This screening room is Will-only." }, { status: 403 });

  const runtimeEnv = env as unknown as RuntimeEnv;
  const db = await database();
  if (!db || !runtimeEnv.POSTERS) return Response.json({ error: "Publishing storage is unavailable." }, { status: 503 });

  let posterKey = "";
  try {
    const form = await request.formData();
    const movieId = textField(form, "movieId");
    const title = textField(form, "title");
    const releaseYear = textField(form, "year");
    const genre = textField(form, "genre");
    const runtime = Number(textField(form, "runtime"));
    const rating = Number(textField(form, "rating"));
    const blurb = textField(form, "blurb");
    const reviewText = textField(form, "reviewText");
    const poster = form.get("poster");

    if (!movieId || !title) return Response.json({ error: "Select a movie from the search results." }, { status: 400 });
    if (!genre || !Number.isInteger(runtime) || runtime < 1 || runtime > 600) return Response.json({ error: "Add a genre and valid runtime." }, { status: 400 });
    if (!Number.isFinite(rating) || rating < 0 || rating > 10) return Response.json({ error: "The Will-o-Meter needs a score from 0 to 10." }, { status: 400 });
    if (blurb.length < 10 || reviewText.length < 40) return Response.json({ error: "Add a quick take and at least 40 characters for the full review." }, { status: 400 });
    if (!(poster instanceof File) || poster.size === 0) return Response.json({ error: "Upload one poster image." }, { status: 400 });
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(poster.type)) return Response.json({ error: "Use a JPG, PNG, or WebP poster." }, { status: 400 });
    if (poster.size > 8 * 1024 * 1024) return Response.json({ error: "Keep the poster under 8 MB." }, { status: 400 });

    const extension = poster.type === "image/png" ? "png" : poster.type === "image/webp" ? "webp" : "jpg";
    const slug = `${slugify(title)}-${releaseYear || "film"}-${Date.now().toString(36)}`;
    posterKey = `${crypto.randomUUID()}.${extension}`;
    await runtimeEnv.POSTERS.put(posterKey, await poster.arrayBuffer(), {
      httpMetadata: { contentType: poster.type, cacheControl: "public, max-age=31536000, immutable" },
    });

    const result = await db.prepare(`INSERT INTO reviews
      (slug, movie_id, title, release_year, genre, runtime, rating_tenths, blurb, review_text, poster_key, poster_content_type, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(slug, movieId, title, releaseYear, genre, runtime, Math.round(rating * 10), blurb, reviewText, posterKey, poster.type, owner.email)
      .run();

    const created = await db.prepare(`SELECT id, slug, movie_id, title, release_year, genre, runtime,
      rating_tenths, blurb, review_text, poster_key, published_at FROM reviews WHERE id = ?`)
      .bind(result.meta.last_row_id)
      .first<ReviewRow>();
    return Response.json({ ok: true, review: created ? serialize(created) : null });
  } catch {
    if (posterKey) await runtimeEnv.POSTERS.delete(posterKey).catch(() => undefined);
    return Response.json({ error: "The projector jammed. Your review was not published." }, { status: 500 });
  }
}

import { env } from "cloudflare:workers";
import { getStudioOwner } from "../../../studio-auth";
import { sendInstantReview } from "../../../newsletter-service";
import { formatReviewGenres, parseReviewGenres } from "../../../genres";
import { fallbackReviews } from "../../../review-catalog";
import { getWatchListing } from "../../../watch-catalog";
import {
  canonicalChoice,
  formatWatchParties,
  parseWatchParties,
  REWATCH_ODDS,
  SLEEP_RISKS,
} from "../../../review-experience";

type RuntimeEnv = {
  DB?: D1Database;
  POSTERS?: R2Bucket;
  RESEND_API_KEY?: string;
  NEWSLETTER_FROM?: string;
  NEWSLETTER_REPLY_TO?: string;
  NEWSLETTER_SITE_URL?: string;
};

type ReviewRow = {
  id: number;
  slug: string;
  movie_id: string;
  title: string;
  release_year: string;
  genre: string;
  runtime: number;
  content_rating: string;
  rating_tenths: number;
  blurb: string;
  review_text: string;
  favorite_quote: string;
  rewatch_odds: string;
  watch_party: string;
  sleep_risk: string;
  amazon_url: string;
  apple_url: string;
  poster_key: string;
  poster_content_type: string;
  published_at: string;
};

type ReviewFields = {
  movieId: string;
  title: string;
  releaseYear: string;
  genre: string;
  runtime: number;
  contentRating: string;
  rating: number;
  blurb: string;
  reviewText: string;
  favoriteQuote: string;
  rewatchOdds: string;
  watchParty: string;
  sleepRisk: string;
  amazonUrl: string;
  appleUrl: string;
};

const reviewColumns = `id, slug, movie_id, title, release_year, genre, runtime, content_rating,
  rating_tenths, blurb, review_text, favorite_quote, rewatch_odds, watch_party, sleep_risk,
  amazon_url, apple_url, poster_key, poster_content_type, published_at`;
const allowedPosterTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

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
    content_rating TEXT NOT NULL DEFAULT '',
    rating_tenths INTEGER NOT NULL,
    blurb TEXT NOT NULL,
    review_text TEXT NOT NULL,
    favorite_quote TEXT NOT NULL DEFAULT '',
    rewatch_odds TEXT NOT NULL DEFAULT '',
    watch_party TEXT NOT NULL DEFAULT '',
    sleep_risk TEXT NOT NULL DEFAULT '',
    amazon_url TEXT NOT NULL DEFAULT '',
    apple_url TEXT NOT NULL DEFAULT '',
    poster_key TEXT NOT NULL,
    poster_content_type TEXT NOT NULL,
    created_by TEXT NOT NULL,
    published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  const columns = await db.prepare(`PRAGMA table_info(reviews)`).all<{ name: string }>();
  const missingColumns = [
    ["favorite_quote", `ALTER TABLE reviews ADD COLUMN favorite_quote TEXT NOT NULL DEFAULT ''`],
    ["rewatch_odds", `ALTER TABLE reviews ADD COLUMN rewatch_odds TEXT NOT NULL DEFAULT ''`],
    ["watch_party", `ALTER TABLE reviews ADD COLUMN watch_party TEXT NOT NULL DEFAULT ''`],
    ["sleep_risk", `ALTER TABLE reviews ADD COLUMN sleep_risk TEXT NOT NULL DEFAULT ''`],
    ["content_rating", `ALTER TABLE reviews ADD COLUMN content_rating TEXT NOT NULL DEFAULT ''`],
    ["amazon_url", `ALTER TABLE reviews ADD COLUMN amazon_url TEXT NOT NULL DEFAULT ''`],
    ["apple_url", `ALTER TABLE reviews ADD COLUMN apple_url TEXT NOT NULL DEFAULT ''`],
  ] as const;
  for (const [name, statement] of missingColumns) {
    if (!columns.results.some((column) => column.name === name)) await db.prepare(statement).run();
  }
  return db;
}

function serialize(row: ReviewRow) {
  const listing = getWatchListing(row.title, row.release_year);
  const catalogAmazonUrl = listing?.amazonId
    ? `https://www.amazon.com/gp/video/detail/${listing.amazonId}/ref=nosim`
    : listing?.amazonQuery
      ? `https://www.amazon.com/s?k=${encodeURIComponent(listing.amazonQuery)}&i=instant-video`
      : "";
  return {
    id: `review-${row.id}`,
    slug: row.slug,
    movieId: row.movie_id,
    title: row.title,
    year: row.release_year,
    genre: row.genre,
    runtime: row.runtime,
    contentRating: row.content_rating,
    rating: row.rating_tenths / 10,
    blurb: row.blurb,
    reviewText: row.review_text,
    favoriteQuote: row.favorite_quote,
    rewatchOdds: row.rewatch_odds,
    watchParty: row.watch_party,
    sleepRisk: row.sleep_risk,
    amazonUrl: row.amazon_url || catalogAmazonUrl,
    appleUrl: row.apple_url || listing?.appleUrl || "",
    poster: row.poster_content_type === "external/url"
      ? row.poster_key
      : `/api/posters/${encodeURIComponent(row.poster_key)}`,
    publishedAt: row.published_at,
  };
}

function serializeCatalogReview(review: typeof fallbackReviews[number]) {
  const listing = getWatchListing(review.title, review.year);
  const amazonUrl = listing?.amazonId
    ? `https://www.amazon.com/gp/video/detail/${listing.amazonId}/ref=nosim`
    : listing?.amazonQuery
      ? `https://www.amazon.com/s?k=${encodeURIComponent(listing.amazonQuery)}&i=instant-video`
      : "";
  return {
    id: review.id,
    movieId: review.id,
    title: review.title,
    year: review.year,
    genre: review.genre,
    runtime: review.runtime,
    contentRating: review.contentRating ?? "",
    rating: review.rating,
    blurb: review.blurb,
    reviewText: review.reviewText,
    favoriteQuote: review.favoriteQuote ?? "",
    rewatchOdds: review.rewatchOdds ?? "",
    watchParty: review.watchParty ?? "",
    sleepRisk: review.sleepRisk ?? "",
    amazonUrl,
    appleUrl: listing?.appleUrl ?? "",
    poster: review.poster,
    publishedAt: "",
  };
}

function textField(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "movie";
}

function reviewFields(form: FormData): ReviewFields {
  const genres = parseReviewGenres(textField(form, "genre"));
  return {
    movieId: textField(form, "movieId"),
    title: textField(form, "title"),
    releaseYear: textField(form, "year"),
    genre: formatReviewGenres(genres),
    runtime: Number(textField(form, "runtime")),
    contentRating: textField(form, "contentRating").toUpperCase().slice(0, 12),
    rating: Number(textField(form, "rating")),
    blurb: textField(form, "blurb"),
    reviewText: textField(form, "reviewText"),
    favoriteQuote: textField(form, "favoriteQuote"),
    rewatchOdds: canonicalChoice(textField(form, "rewatchOdds"), REWATCH_ODDS),
    watchParty: formatWatchParties(parseWatchParties(textField(form, "watchParty"))),
    sleepRisk: canonicalChoice(textField(form, "sleepRisk"), SLEEP_RISKS),
    amazonUrl: textField(form, "amazonUrl"),
    appleUrl: textField(form, "appleUrl"),
  };
}

function isProviderUrl(value: string, provider: "amazon" | "apple") {
  if (!value) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (provider === "amazon") return url.hostname === "amazon.com" || url.hostname.endsWith(".amazon.com");
    return url.hostname === "tv.apple.com" || url.hostname === "itunes.apple.com";
  } catch {
    return false;
  }
}

function reviewError(fields: ReviewFields, minimumReviewLength = 40) {
  if (!fields.movieId || !fields.title) return "Select a movie from the search results.";
  if (!fields.genre || !Number.isInteger(fields.runtime) || fields.runtime < 1 || fields.runtime > 600) {
    return "Pick at least one listed genre and add a valid runtime.";
  }
  if (!Number.isFinite(fields.rating) || fields.rating < 0 || fields.rating > 10) {
    return "The Will-o-Meter needs a score from 0 to 10.";
  }
  if (fields.blurb.length < 10 || fields.reviewText.length < minimumReviewLength) {
    return minimumReviewLength === 40
      ? "Add a quick take and at least 40 characters for the full review."
      : "Add a quick take and a full review.";
  }
  if (fields.favoriteQuote.length > 300) return "Keep the favorite quote under 300 characters.";
  if (!isProviderUrl(fields.amazonUrl, "amazon")) return "Use a full amazon.com movie URL or leave it blank.";
  if (!isProviderUrl(fields.appleUrl, "apple")) return "Use a full Apple TV movie URL or leave it blank.";
  return "";
}

function posterError(poster: File) {
  if (!allowedPosterTypes.has(poster.type)) return "Use a JPG, PNG, or WebP poster.";
  if (poster.size > 8 * 1024 * 1024) return "Keep the poster under 8 MB.";
  return "";
}

async function storePoster(bucket: R2Bucket, poster: File) {
  const extension = poster.type === "image/png" ? "png" : poster.type === "image/webp" ? "webp" : "jpg";
  const posterKey = `${crypto.randomUUID()}.${extension}`;
  await bucket.put(posterKey, await poster.arrayBuffer(), {
    httpMetadata: { contentType: poster.type, cacheControl: "public, max-age=31536000, immutable" },
  });
  return posterKey;
}

export async function GET() {
  const owner = await getStudioOwner();
  if (!owner) return Response.json({ error: "This screening room is Will-only." }, { status: 403 });

  try {
    const db = await database();
    if (!db) return Response.json({ error: "Review storage is unavailable." }, { status: 503 });
    const result = await db.prepare(`SELECT ${reviewColumns}
      FROM reviews ORDER BY published_at DESC, id DESC LIMIT 100`).all<ReviewRow>();
    const savedMovieIds = new Set(result.results.map((review) => review.movie_id));
    const savedTitles = new Set(result.results.map((review) => review.title.toLowerCase()));
    const catalogReviews = fallbackReviews
      .filter((review) => !savedMovieIds.has(review.id) && !savedTitles.has(review.title.toLowerCase()))
      .map(serializeCatalogReview);
    return Response.json({ reviews: [...result.results.map(serialize), ...catalogReviews] });
  } catch {
    return Response.json({ error: "The review archive would not open." }, { status: 500 });
  }
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
    const fields = reviewFields(form);
    const poster = form.get("poster");

    const fieldError = reviewError(fields);
    if (fieldError) return Response.json({ error: fieldError }, { status: 400 });
    if (!(poster instanceof File) || poster.size === 0) return Response.json({ error: "Upload one poster image." }, { status: 400 });
    const invalidPoster = posterError(poster);
    if (invalidPoster) return Response.json({ error: invalidPoster }, { status: 400 });

    const slug = `${slugify(fields.title)}-${fields.releaseYear || "film"}-${Date.now().toString(36)}`;
    posterKey = await storePoster(runtimeEnv.POSTERS, poster);

    const result = await db.prepare(`INSERT INTO reviews
      (slug, movie_id, title, release_year, genre, runtime, content_rating, rating_tenths, blurb, review_text,
      favorite_quote, rewatch_odds, watch_party, sleep_risk, amazon_url, apple_url,
      poster_key, poster_content_type, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        slug,
        fields.movieId,
        fields.title,
        fields.releaseYear,
        fields.genre,
        fields.runtime,
        fields.contentRating,
        Math.round(fields.rating * 10),
        fields.blurb,
        fields.reviewText,
        fields.favoriteQuote,
        fields.rewatchOdds,
        fields.watchParty,
        fields.sleepRisk,
        fields.amazonUrl,
        fields.appleUrl,
        posterKey,
        poster.type,
        owner.email,
      )
      .run();

    const created = await db.prepare(`SELECT ${reviewColumns} FROM reviews WHERE id = ?`)
      .bind(result.meta.last_row_id)
      .first<ReviewRow>();
    const newsletter = created
      ? await sendInstantReview(db, runtimeEnv, created)
      : { status: "pending" as const };
    return Response.json({ ok: true, review: created ? serialize(created) : null, newsletter });
  } catch {
    if (posterKey) await runtimeEnv.POSTERS.delete(posterKey).catch(() => undefined);
    return Response.json({ error: "The projector jammed. Your review was not published." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const owner = await getStudioOwner();
  if (!owner) return Response.json({ error: "This screening room is Will-only." }, { status: 403 });

  const runtimeEnv = env as unknown as RuntimeEnv;
  const db = await database();
  if (!db || !runtimeEnv.POSTERS) return Response.json({ error: "Publishing storage is unavailable." }, { status: 503 });

  let replacementPosterKey = "";
  try {
    const form = await request.formData();
    const reviewIdentifier = textField(form, "reviewId");
    const numericReviewMatch = reviewIdentifier.match(/^review-(\d+)$/);
    const reviewId = numericReviewMatch ? Number(numericReviewMatch[1]) : 0;
    const catalogReview = fallbackReviews.find((review) => review.id === reviewIdentifier);
    const fields = reviewFields(form);
    const poster = form.get("poster");
    const replacementPoster = poster instanceof File && poster.size > 0 ? poster : null;

    if ((!Number.isInteger(reviewId) || reviewId < 1) && !catalogReview) {
      return Response.json({ error: "Choose a published review to edit." }, { status: 400 });
    }
    const fieldError = reviewError(fields, 1);
    if (fieldError) return Response.json({ error: fieldError }, { status: 400 });
    if (replacementPoster) {
      const invalidPoster = posterError(replacementPoster);
      if (invalidPoster) return Response.json({ error: invalidPoster }, { status: 400 });
    }

    if (catalogReview) {
      if (replacementPoster) replacementPosterKey = await storePoster(runtimeEnv.POSTERS, replacementPoster);
      const posterKey = replacementPosterKey || catalogReview.poster;
      const posterContentType = replacementPoster?.type || "external/url";
      const slug = `${slugify(fields.title)}-${fields.releaseYear || "film"}-${Date.now().toString(36)}`;
      const result = await db.prepare(`INSERT INTO reviews
        (slug, movie_id, title, release_year, genre, runtime, content_rating, rating_tenths, blurb, review_text,
        favorite_quote, rewatch_odds, watch_party, sleep_risk, amazon_url, apple_url,
        poster_key, poster_content_type, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          slug,
          fields.movieId,
          fields.title,
          fields.releaseYear,
          fields.genre,
          fields.runtime,
          fields.contentRating,
          Math.round(fields.rating * 10),
          fields.blurb,
          fields.reviewText,
          fields.favoriteQuote,
          fields.rewatchOdds,
          fields.watchParty,
          fields.sleepRisk,
          fields.amazonUrl,
          fields.appleUrl,
          posterKey,
          posterContentType,
          owner.email,
        )
        .run();
      const created = await db.prepare(`SELECT ${reviewColumns} FROM reviews WHERE id = ?`)
        .bind(result.meta.last_row_id)
        .first<ReviewRow>();
      return Response.json({ ok: true, review: created ? serialize(created) : null });
    }

    const existing = await db.prepare(`SELECT ${reviewColumns} FROM reviews WHERE id = ?`)
      .bind(reviewId)
      .first<ReviewRow>();
    if (!existing) return Response.json({ error: "That review is no longer in the archive." }, { status: 404 });

    if (replacementPoster) replacementPosterKey = await storePoster(runtimeEnv.POSTERS, replacementPoster);
    const posterKey = replacementPosterKey || existing.poster_key;
    const posterContentType = replacementPoster?.type || existing.poster_content_type;

    await db.prepare(`UPDATE reviews SET
      movie_id = ?, title = ?, release_year = ?, genre = ?, runtime = ?, content_rating = ?, rating_tenths = ?,
      blurb = ?, review_text = ?, favorite_quote = ?, rewatch_odds = ?, watch_party = ?,
      sleep_risk = ?, amazon_url = ?, apple_url = ?, poster_key = ?, poster_content_type = ?
      WHERE id = ?`)
      .bind(
        fields.movieId,
        fields.title,
        fields.releaseYear,
        fields.genre,
        fields.runtime,
        fields.contentRating,
        Math.round(fields.rating * 10),
        fields.blurb,
        fields.reviewText,
        fields.favoriteQuote,
        fields.rewatchOdds,
        fields.watchParty,
        fields.sleepRisk,
        fields.amazonUrl,
        fields.appleUrl,
        posterKey,
        posterContentType,
        reviewId,
      )
      .run();

    const updated = await db.prepare(`SELECT ${reviewColumns} FROM reviews WHERE id = ?`)
      .bind(reviewId)
      .first<ReviewRow>();
    if (replacementPosterKey && existing.poster_content_type !== "external/url") {
      await runtimeEnv.POSTERS.delete(existing.poster_key).catch(() => undefined);
    }
    return Response.json({ ok: true, review: updated ? serialize(updated) : null });
  } catch {
    if (replacementPosterKey) await runtimeEnv.POSTERS.delete(replacementPosterKey).catch(() => undefined);
    return Response.json({ error: "The projector jammed. Your changes were not saved." }, { status: 500 });
  }
}

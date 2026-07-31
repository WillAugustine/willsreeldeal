import { env } from "cloudflare:workers";
import { ensureNewsletterTables, syncNewsletterSubscriber } from "../../newsletter-service";
import { fallbackReviews } from "../../review-catalog";

type RuntimeEnv = {
  DB?: D1Database;
  RESEND_API_KEY?: string;
  NEWSLETTER_FROM?: string;
  NEWSLETTER_REPLY_TO?: string;
  NEWSLETTER_SITE_URL?: string;
};

async function database() {
  const db = (env as unknown as RuntimeEnv).DB;
  if (!db) return null;
  await ensureNewsletterTables(db);
  await db.prepare(`CREATE TABLE IF NOT EXISTS movie_requests (
      movie_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      release_year TEXT NOT NULL DEFAULT '',
      votes INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run();
  return db;
}

async function getLeaders(db: D1Database) {
  let requests: Record<string, unknown>[];
  try {
    const stale = await db.prepare(`SELECT movie_requests.movie_id AS id
      FROM movie_requests
      INNER JOIN reviews ON reviews.movie_id = movie_requests.movie_id
        OR (LOWER(TRIM(reviews.title)) = LOWER(TRIM(movie_requests.title))
          AND reviews.release_year = movie_requests.release_year)
      LIMIT 50`).all<{ id: string }>();
    if (stale.results.length) {
      await db.batch(stale.results.map((movie) => (
        db.prepare("DELETE FROM movie_requests WHERE movie_id = ?").bind(movie.id)
      )));
    }
    const result = await db.prepare(`SELECT movie_id AS id, title, release_year AS year, votes
      FROM movie_requests
      WHERE NOT EXISTS (
        SELECT 1 FROM reviews
        WHERE reviews.movie_id = movie_requests.movie_id
          OR (LOWER(TRIM(reviews.title)) = LOWER(TRIM(movie_requests.title))
            AND reviews.release_year = movie_requests.release_year)
      )
      ORDER BY votes DESC, updated_at ASC LIMIT 30`).all();
    requests = result.results;
  } catch {
    const result = await db.prepare(`SELECT movie_id AS id, title, release_year AS year, votes
      FROM movie_requests ORDER BY votes DESC, updated_at ASC LIMIT 30`).all();
    requests = result.results;
  }
  return requests.filter((movie) => !fallbackReviews.some((review) => (
    review.id === movie.id
      || (review.title.trim().toLowerCase() === String(movie.title).trim().toLowerCase() && review.year === movie.year)
  ))).slice(0, 5);
}

async function alreadyReviewed(db: D1Database, movie: { id: string; title: string; year: string }) {
  if (fallbackReviews.some((review) => (
    review.id === movie.id
      || (review.title.trim().toLowerCase() === movie.title.trim().toLowerCase() && review.year === movie.year)
  ))) return true;

  try {
    const review = await db.prepare(`SELECT id FROM reviews WHERE movie_id = ?
      OR (LOWER(TRIM(title)) = LOWER(TRIM(?)) AND release_year = ?) LIMIT 1`)
      .bind(movie.id, movie.title, movie.year)
      .first<{ id: number }>();
    return Boolean(review);
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const db = await database();
    if (!db) return Response.json({ leaders: [] });
    return Response.json({ leaders: await getLeaders(db) });
  } catch {
    return Response.json({ leaders: [] });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as {
      action?: string;
      email?: string;
      frequency?: string;
      movie?: { id?: string; title?: string; year?: string };
      notify?: boolean;
      notificationEmail?: string;
    };
    const db = await database();
    if (!db) return Response.json({ error: "Community database is unavailable" }, { status: 503 });

    if (payload.action === "newsletter") {
      const email = payload.email?.trim().toLowerCase() ?? "";
      const frequency = payload.frequency === "instant" ? "instant" : "biweekly";
      if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "A valid email is required" }, { status: 400 });
      await db.prepare(`INSERT INTO newsletter_subscribers (email, frequency) VALUES (?, ?)
        ON CONFLICT(email) DO UPDATE SET frequency = excluded.frequency, updated_at = CURRENT_TIMESTAMP`).bind(email, frequency).run();
      let delivery = "pending";
      try {
        const synced = await syncNewsletterSubscriber(db, env as unknown as RuntimeEnv, { email, frequency });
        delivery = synced.status;
      } catch {
        delivery = "pending";
      }
      return Response.json({ ok: true, delivery });
    }

    if (payload.action === "request") {
      const movie = payload.movie;
      if (!movie?.id || !movie.title) return Response.json({ error: "Select a movie from search" }, { status: 400 });
      const normalizedMovie = { id: movie.id, title: movie.title.trim(), year: movie.year?.trim() ?? "" };
      if (await alreadyReviewed(db, normalizedMovie)) {
        return Response.json({ error: "Will has already reviewed that movie. Find it in The Takes." }, { status: 409 });
      }

      const notificationEmail = payload.notificationEmail?.trim().toLowerCase() ?? "";
      if (payload.notify && (notificationEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationEmail))) {
        return Response.json({ error: "Enter a valid email for the review alert." }, { status: 400 });
      }

      const statements = [
        db.prepare(`INSERT INTO movie_requests (movie_id, title, release_year, votes) VALUES (?, ?, ?, 1)
          ON CONFLICT(movie_id) DO UPDATE SET votes = votes + 1, updated_at = CURRENT_TIMESTAMP`)
          .bind(normalizedMovie.id, normalizedMovie.title, normalizedMovie.year),
      ];
      if (payload.notify) {
        statements.push(db.prepare(`INSERT INTO movie_request_notifications
          (movie_id, title, release_year, email) VALUES (?, ?, ?, ?)
          ON CONFLICT(movie_id, email) DO UPDATE SET
            title = excluded.title,
            release_year = excluded.release_year,
            last_error = NULL,
            attempted_at = NULL`)
          .bind(normalizedMovie.id, normalizedMovie.title, normalizedMovie.year, notificationEmail));
      }
      await db.batch(statements);
      return Response.json({ ok: true, leaders: await getLeaders(db) });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return Response.json({ error: "The projector had a moment" }, { status: 500 });
  }
}

import { env } from "cloudflare:workers";
import { ensureNewsletterTables, syncNewsletterSubscriber } from "../../newsletter-service";

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
  const result = await db.prepare("SELECT movie_id AS id, title, release_year AS year, votes FROM movie_requests ORDER BY votes DESC, updated_at ASC LIMIT 5").all();
  return result.results;
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
    const payload = await request.json() as { action?: string; email?: string; frequency?: string; movie?: { id?: string; title?: string; year?: string } };
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
      await db.prepare(`INSERT INTO movie_requests (movie_id, title, release_year, votes) VALUES (?, ?, ?, 1)
        ON CONFLICT(movie_id) DO UPDATE SET votes = votes + 1, updated_at = CURRENT_TIMESTAMP`).bind(movie.id, movie.title.trim(), movie.year ?? "").run();
      return Response.json({ ok: true, leaders: await getLeaders(db) });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return Response.json({ error: "The projector had a moment" }, { status: 500 });
  }
}

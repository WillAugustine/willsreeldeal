import { env } from "cloudflare:workers";

type RuntimeEnv = { DB?: D1Database };

async function database() {
  const db = (env as unknown as RuntimeEnv).DB;
  if (!db) return null;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      frequency TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS movie_requests (
      movie_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      release_year TEXT NOT NULL DEFAULT '',
      votes INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("INSERT OR IGNORE INTO movie_requests (movie_id, title, release_year, votes) VALUES ('Q124378349', 'The Wild Robot', '2024', 47)"),
    db.prepare("INSERT OR IGNORE INTO movie_requests (movie_id, title, release_year, votes) VALUES ('Q125473145', 'Sinners', '2025', 39)"),
    db.prepare("INSERT OR IGNORE INTO movie_requests (movie_id, title, release_year, votes) VALUES ('Q47703', 'The Godfather', '1972', 31)"),
    db.prepare("INSERT OR IGNORE INTO movie_requests (movie_id, title, release_year, votes) VALUES ('Q13417189', 'Interstellar', '2014', 26)"),
    db.prepare("INSERT OR IGNORE INTO movie_requests (movie_id, title, release_year, votes) VALUES ('Q113380226', 'The Substance', '2024', 19)"),
  ]);
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
      return Response.json({ ok: true });
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

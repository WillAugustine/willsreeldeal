type NewsletterEnv = {
  RESEND_API_KEY?: string;
  NEWSLETTER_FROM?: string;
  NEWSLETTER_REPLY_TO?: string;
  NEWSLETTER_SITE_URL?: string;
};

type NewsletterConfiguration = {
  instant_segment_id: string;
  biweekly_segment_id: string;
  instant_topic_id: string;
  biweekly_topic_id: string;
};

type SubscriberRow = {
  email: string;
  frequency: "instant" | "biweekly";
};

type ReviewForEmail = {
  id: number;
  slug: string;
  title: string;
  release_year: string;
  rating_tenths: number;
  blurb: string;
  review_text: string;
  favorite_quote: string;
  poster_key: string;
  published_at: string;
};

type ResendResponse = {
  id?: string;
  message?: string;
  error?: { message?: string };
};

const RESEND_API = "https://api.resend.com";
const DEFAULT_FROM = "Will's Reel Deal <reelmail@updates.willsreeldeal.com>";
const DEFAULT_SITE_URL = "https://willsreeldeal.com";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function siteUrl(runtimeEnv: NewsletterEnv) {
  return (runtimeEnv.NEWSLETTER_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");
}

async function resendRequest(
  runtimeEnv: NewsletterEnv,
  path: string,
  init: RequestInit,
  allowNotFound = false,
) {
  if (!runtimeEnv.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");
  const response = await fetch(`${RESEND_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${runtimeEnv.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "User-Agent": "wills-reel-deal/1.0",
      ...init.headers,
    },
  });
  if (allowNotFound && response.status === 404) return null;
  const data = await response.json().catch(() => ({})) as ResendResponse;
  if (!response.ok) {
    throw new Error(data.message || data.error?.message || `Resend request failed with ${response.status}`);
  }
  return data;
}

export async function ensureNewsletterTables(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      frequency TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS newsletter_configuration (
      id INTEGER PRIMARY KEY,
      instant_segment_id TEXT NOT NULL,
      biweekly_segment_id TEXT NOT NULL,
      instant_topic_id TEXT NOT NULL,
      biweekly_topic_id TEXT NOT NULL,
      initialized_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS newsletter_sends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      send_key TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      provider_id TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_unique ON newsletter_subscribers (email)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS newsletter_sends_send_key_unique ON newsletter_sends (send_key)"),
  ]);
}

async function createResendResource(
  runtimeEnv: NewsletterEnv,
  path: "/segments" | "/topics",
  body: Record<string, unknown>,
) {
  const data = await resendRequest(runtimeEnv, path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!data?.id) throw new Error(`Resend did not return an ID for ${path}`);
  return data.id;
}

export async function ensureResendConfiguration(db: D1Database, runtimeEnv: NewsletterEnv) {
  await ensureNewsletterTables(db);
  const existing = await db.prepare(`SELECT instant_segment_id, biweekly_segment_id,
    instant_topic_id, biweekly_topic_id FROM newsletter_configuration WHERE id = 1`)
    .first<NewsletterConfiguration>();
  if (existing) return existing;
  if (!runtimeEnv.RESEND_API_KEY) return null;

  const instantSegmentId = await createResendResource(runtimeEnv, "/segments", {
    name: "Reel Mail - Every New Review",
  });
  const biweeklySegmentId = await createResendResource(runtimeEnv, "/segments", {
    name: "Reel Mail - Every Other Week",
  });
  const instantTopicId = await createResendResource(runtimeEnv, "/topics", {
    name: "Every New Review",
    description: "A fresh Reel Mail message whenever Will publishes a movie review.",
    default_subscription: "opt_out",
  });
  const biweeklyTopicId = await createResendResource(runtimeEnv, "/topics", {
    name: "Double Feature Digest",
    description: "One Reel Mail digest every other week with Will's latest reviews.",
    default_subscription: "opt_out",
  });

  await db.prepare(`INSERT INTO newsletter_configuration
    (id, instant_segment_id, biweekly_segment_id, instant_topic_id, biweekly_topic_id)
    VALUES (1, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      instant_segment_id = excluded.instant_segment_id,
      biweekly_segment_id = excluded.biweekly_segment_id,
      instant_topic_id = excluded.instant_topic_id,
      biweekly_topic_id = excluded.biweekly_topic_id,
      updated_at = CURRENT_TIMESTAMP`)
    .bind(instantSegmentId, biweeklySegmentId, instantTopicId, biweeklyTopicId)
    .run();

  return {
    instant_segment_id: instantSegmentId,
    biweekly_segment_id: biweeklySegmentId,
    instant_topic_id: instantTopicId,
    biweekly_topic_id: biweeklyTopicId,
  };
}

async function ignoreMissingResendRequest(runtimeEnv: NewsletterEnv, path: string, init: RequestInit) {
  try {
    await resendRequest(runtimeEnv, path, init, true);
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) return;
    throw error;
  }
}

export async function syncNewsletterSubscriber(
  db: D1Database,
  runtimeEnv: NewsletterEnv,
  subscriber: SubscriberRow,
) {
  const configuration = await ensureResendConfiguration(db, runtimeEnv);
  if (!configuration) return { status: "pending" as const };

  const contactPath = `/contacts/${encodeURIComponent(subscriber.email)}`;
  const existing = await resendRequest(runtimeEnv, contactPath, { method: "GET" }, true);
  const selectedSegment = subscriber.frequency === "instant"
    ? configuration.instant_segment_id
    : configuration.biweekly_segment_id;
  const topics = [
    {
      id: configuration.instant_topic_id,
      subscription: subscriber.frequency === "instant" ? "opt_in" : "opt_out",
    },
    {
      id: configuration.biweekly_topic_id,
      subscription: subscriber.frequency === "biweekly" ? "opt_in" : "opt_out",
    },
  ];

  if (!existing) {
    await resendRequest(runtimeEnv, "/contacts", {
      method: "POST",
      body: JSON.stringify({
        email: subscriber.email,
        unsubscribed: false,
        segments: [{ id: selectedSegment }],
        topics,
      }),
    });
    return { status: "ready" as const };
  }

  await resendRequest(runtimeEnv, contactPath, {
    method: "PATCH",
    body: JSON.stringify({ unsubscribed: false }),
  });
  await Promise.all([
    ignoreMissingResendRequest(
      runtimeEnv,
      `${contactPath}/segments/${configuration.instant_segment_id}`,
      { method: "DELETE" },
    ),
    ignoreMissingResendRequest(
      runtimeEnv,
      `${contactPath}/segments/${configuration.biweekly_segment_id}`,
      { method: "DELETE" },
    ),
  ]);
  await resendRequest(runtimeEnv, `${contactPath}/segments/${selectedSegment}`, { method: "POST" });
  await resendRequest(runtimeEnv, `${contactPath}/topics`, {
    method: "PATCH",
    body: JSON.stringify(topics),
  });
  return { status: "ready" as const };
}

function emailShell(content: string, preheader: string, runtimeEnv: NewsletterEnv) {
  const root = siteUrl(runtimeEnv);
  return `<!doctype html>
  <html lang="en">
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
    <body style="margin:0;background:#0e2b1d;color:#10281c;font-family:Arial,sans-serif;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0e2b1d;padding:28px 12px;">
        <tr><td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#f4f0df;border:1px solid #9abf56;">
            <tr><td style="padding:24px 30px;background:#15452d;color:#f4f0df;">
              <a href="${root}" style="color:#d7f15b;text-decoration:none;font:700 25px Georgia,serif;">WILL'S REEL DEAL</a>
              <div style="font-size:10px;letter-spacing:1.6px;margin-top:5px;">OPINIONS, LIGHTLY BUTTERED</div>
            </td></tr>
            <tr><td style="padding:34px 30px;">${content}</td></tr>
            <tr><td style="padding:24px 30px;background:#e97443;color:#10281c;font-size:12px;line-height:1.55;">
              You picked your preferred Reel Mail schedule when you signed up.
              <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#10281c;font-weight:700;">Change preferences or unsubscribe</a>.
              <div style="margin-top:10px;">Will's Reel Deal, Denver, Colorado</div>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`;
}

function instantEmail(review: ReviewForEmail, runtimeEnv: NewsletterEnv) {
  const root = siteUrl(runtimeEnv);
  const rating = (review.rating_tenths / 10).toFixed(review.rating_tenths % 10 ? 1 : 0);
  const reviewUrl = `${root}/#reviews`;
  const posterUrl = `${root}/api/posters/${encodeURIComponent(review.poster_key)}`;
  const content = `
    <p style="margin:0 0 9px;color:#49715d;font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;">Fresh outta the projector</p>
    <h1 style="margin:0 0 18px;font:700 43px/1 Georgia,serif;letter-spacing:-1.5px;">${escapeHtml(review.title)}</h1>
    <img src="${posterUrl}" alt="Poster for ${escapeHtml(review.title)}" width="210" style="display:block;width:210px;max-width:100%;height:auto;margin:0 0 24px;border:0;">
    <p style="margin:0 0 12px;font-size:18px;line-height:1.45;"><strong>Will-o-Meter: ${rating}/10</strong></p>
    <p style="margin:0 0 24px;font:italic 20px/1.45 Georgia,serif;">"${escapeHtml(review.blurb)}"</p>
    ${review.favorite_quote ? `<div style="margin:0 0 24px;border-left:4px solid #e97443;background:#f7e5da;padding:14px 16px;"><div style="color:#9a4d2c;font-size:10px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;">Favorite line</div><p style="margin:7px 0 0;font:italic 16px/1.5 Georgia,serif;">${escapeHtml(review.favorite_quote)}</p></div>` : ""}
    <a href="${reviewUrl}" style="display:inline-block;background:#d7f15b;color:#10281c;padding:14px 20px;text-decoration:none;font-size:12px;font-weight:900;letter-spacing:.5px;">READ WILL'S FULL TAKE</a>`;
  return {
    subject: `Fresh take: ${review.title} gets a ${rating}/10`,
    html: emailShell(content, `${review.title} just landed on Will's Reel Deal.`, runtimeEnv),
  };
}

function biweeklyEmail(reviews: ReviewForEmail[], runtimeEnv: NewsletterEnv) {
  const root = siteUrl(runtimeEnv);
  const cards = reviews.map((review) => {
    const rating = (review.rating_tenths / 10).toFixed(review.rating_tenths % 10 ? 1 : 0);
    return `<tr><td style="padding:22px 0;border-top:1px solid #c9c3ad;">
      <div style="color:#49715d;font-size:10px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;">${escapeHtml(review.release_year)} - Will-o-Meter ${rating}/10</div>
      <h2 style="margin:7px 0 8px;font:700 29px/1.05 Georgia,serif;">${escapeHtml(review.title)}</h2>
      <p style="margin:0;font-size:15px;line-height:1.55;">${escapeHtml(review.blurb)}</p>
      ${review.favorite_quote ? `<p style="margin:12px 0 0;border-left:3px solid #e97443;padding-left:11px;font:italic 14px/1.5 Georgia,serif;">${escapeHtml(review.favorite_quote)}</p>` : ""}
    </td></tr>`;
  }).join("");
  const content = `
    <p style="margin:0 0 9px;color:#49715d;font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;">The Double Feature Digest</p>
    <h1 style="margin:0 0 16px;font:700 43px/1 Georgia,serif;letter-spacing:-1.5px;">The last two weeks, lightly buttered.</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.55;">${reviews.length} new ${reviews.length === 1 ? "review" : "reviews"}, zero film-school homework.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${cards}</table>
    <a href="${root}/#reviews" style="display:inline-block;margin-top:20px;background:#d7f15b;color:#10281c;padding:14px 20px;text-decoration:none;font-size:12px;font-weight:900;letter-spacing:.5px;">SEE ALL THE TAKES</a>`;
  return {
    subject: `Reel Mail: ${reviews.length} fresh ${reviews.length === 1 ? "take" : "takes"} from Will`,
    html: emailShell(content, "Will's newest movie reviews from the last two weeks.", runtimeEnv),
  };
}

async function reserveSend(db: D1Database, sendKey: string, kind: string) {
  const result = await db.prepare(`INSERT OR IGNORE INTO newsletter_sends (send_key, kind, status)
    VALUES (?, ?, 'sending')`).bind(sendKey, kind).run();
  return (result.meta.changes ?? 0) > 0;
}

async function completeSend(
  db: D1Database,
  sendKey: string,
  status: "sent" | "failed" | "skipped",
  providerId?: string,
  errorMessage?: string,
) {
  await db.prepare(`UPDATE newsletter_sends SET status = ?, provider_id = ?, error_message = ?,
    completed_at = CURRENT_TIMESTAMP WHERE send_key = ?`)
    .bind(status, providerId ?? null, errorMessage?.slice(0, 500) ?? null, sendKey)
    .run();
}

async function sendBroadcast(
  runtimeEnv: NewsletterEnv,
  options: {
    segmentId: string;
    topicId: string;
    subject: string;
    html: string;
    name: string;
  },
) {
  const body: Record<string, unknown> = {
    segment_id: options.segmentId,
    topic_id: options.topicId,
    from: runtimeEnv.NEWSLETTER_FROM || DEFAULT_FROM,
    subject: options.subject,
    html: options.html,
    name: options.name,
    send: true,
  };
  if (runtimeEnv.NEWSLETTER_REPLY_TO) body.reply_to = runtimeEnv.NEWSLETTER_REPLY_TO;
  return resendRequest(runtimeEnv, "/broadcasts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function sendInstantReview(
  db: D1Database,
  runtimeEnv: NewsletterEnv,
  review: ReviewForEmail,
) {
  const configuration = await ensureResendConfiguration(db, runtimeEnv);
  if (!configuration) return { status: "pending" as const };
  const sendKey = `instant:${review.id}`;
  if (!await reserveSend(db, sendKey, "instant")) return { status: "already_processed" as const };
  try {
    const email = instantEmail(review, runtimeEnv);
    const result = await sendBroadcast(runtimeEnv, {
      segmentId: configuration.instant_segment_id,
      topicId: configuration.instant_topic_id,
      subject: email.subject,
      html: email.html,
      name: `New review - ${review.title}`,
    });
    await completeSend(db, sendKey, "sent", result?.id);
    return { status: "sent" as const, id: result?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown newsletter error";
    await completeSend(db, sendKey, "failed", undefined, message);
    return { status: "failed" as const, error: message };
  }
}

export async function sendBiweeklyDigest(
  db: D1Database,
  runtimeEnv: NewsletterEnv,
  now = new Date(),
) {
  await ensureNewsletterTables(db);
  const configuration = await ensureResendConfiguration(db, runtimeEnv);
  if (!configuration) return { status: "pending" as const };

  const lastRun = await db.prepare(`SELECT completed_at FROM newsletter_sends
    WHERE kind = 'biweekly' AND status IN ('sent', 'skipped')
    ORDER BY completed_at DESC LIMIT 1`).first<{ completed_at: string }>();
  if (lastRun?.completed_at) {
    const elapsed = now.getTime() - new Date(`${lastRun.completed_at.replace(" ", "T")}Z`).getTime();
    if (elapsed < 13 * 24 * 60 * 60 * 1000) return { status: "too_soon" as const };
  }

  const periodEnd = now.toISOString().slice(0, 10);
  const sendKey = `biweekly:${periodEnd}`;
  if (!await reserveSend(db, sendKey, "biweekly")) return { status: "already_processed" as const };
  const since = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  const result = await db.prepare(`SELECT id, slug, title, release_year, rating_tenths, blurb,
    review_text, favorite_quote, poster_key, published_at FROM reviews
    WHERE published_at >= ? ORDER BY published_at DESC, id DESC`).bind(since).all<ReviewForEmail>();
  const reviews = result.results;
  if (!reviews.length) {
    await completeSend(db, sendKey, "skipped");
    return { status: "no_reviews" as const };
  }

  try {
    const email = biweeklyEmail(reviews, runtimeEnv);
    const sent = await sendBroadcast(runtimeEnv, {
      segmentId: configuration.biweekly_segment_id,
      topicId: configuration.biweekly_topic_id,
      subject: email.subject,
      html: email.html,
      name: `Double Feature Digest - ${periodEnd}`,
    });
    await completeSend(db, sendKey, "sent", sent?.id);
    return { status: "sent" as const, id: sent?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown newsletter error";
    await completeSend(db, sendKey, "failed", undefined, message);
    return { status: "failed" as const, error: message };
  }
}

export async function syncAllNewsletterSubscribers(db: D1Database, runtimeEnv: NewsletterEnv) {
  const configuration = await ensureResendConfiguration(db, runtimeEnv);
  if (!configuration) return { status: "pending" as const, synced: 0 };
  const result = await db.prepare(`SELECT email, frequency FROM newsletter_subscribers
    ORDER BY id ASC`).all<SubscriberRow>();
  let synced = 0;
  for (const subscriber of result.results) {
    await syncNewsletterSubscriber(db, runtimeEnv, subscriber);
    synced += 1;
  }
  return { status: "ready" as const, synced };
}

export async function getNewsletterStatus(db: D1Database, runtimeEnv: NewsletterEnv) {
  await ensureNewsletterTables(db);
  const counts = await db.prepare(`SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN frequency = 'instant' THEN 1 ELSE 0 END) AS instant,
    SUM(CASE WHEN frequency = 'biweekly' THEN 1 ELSE 0 END) AS biweekly
    FROM newsletter_subscribers`).first<{ total: number; instant: number; biweekly: number }>();
  const configuration = await db.prepare("SELECT id FROM newsletter_configuration WHERE id = 1")
    .first<{ id: number }>();
  return {
    apiKeyConfigured: Boolean(runtimeEnv.RESEND_API_KEY),
    connected: Boolean(configuration),
    sender: runtimeEnv.NEWSLETTER_FROM || DEFAULT_FROM,
    subscribers: {
      total: Number(counts?.total ?? 0),
      instant: Number(counts?.instant ?? 0),
      biweekly: Number(counts?.biweekly ?? 0),
    },
  };
}

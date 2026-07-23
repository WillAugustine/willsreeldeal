import { env } from "cloudflare:workers";
import { getStudioOwner } from "../../../studio-auth";
import {
  getNewsletterStatus,
  syncAllNewsletterSubscribers,
} from "../../../newsletter-service";

type RuntimeEnv = {
  DB?: D1Database;
  RESEND_API_KEY?: string;
  NEWSLETTER_FROM?: string;
  NEWSLETTER_REPLY_TO?: string;
  NEWSLETTER_SITE_URL?: string;
};

function runtime() {
  return env as unknown as RuntimeEnv;
}

export async function GET() {
  const owner = await getStudioOwner();
  if (!owner) return Response.json({ error: "This screening room is Will-only." }, { status: 403 });
  const runtimeEnv = runtime();
  if (!runtimeEnv.DB) return Response.json({ error: "Newsletter storage is unavailable." }, { status: 503 });
  return Response.json(await getNewsletterStatus(runtimeEnv.DB, runtimeEnv));
}

export async function POST() {
  const owner = await getStudioOwner();
  if (!owner) return Response.json({ error: "This screening room is Will-only." }, { status: 403 });
  const runtimeEnv = runtime();
  if (!runtimeEnv.DB) return Response.json({ error: "Newsletter storage is unavailable." }, { status: 503 });
  if (!runtimeEnv.RESEND_API_KEY) {
    return Response.json({ error: "Add the RESEND_API_KEY secret in Cloudflare first." }, { status: 409 });
  }
  try {
    const result = await syncAllNewsletterSubscribers(runtimeEnv.DB, runtimeEnv);
    return Response.json({ ok: true, ...result, ...(await getNewsletterStatus(runtimeEnv.DB, runtimeEnv)) });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Reel Mail could not connect.",
    }, { status: 502 });
  }
}

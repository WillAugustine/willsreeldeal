import { env } from "cloudflare:workers";

type RuntimeEnv = { POSTERS?: R2Bucket };

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const bucket = (env as unknown as RuntimeEnv).POSTERS;
  if (!bucket) return new Response("Poster storage unavailable", { status: 503 });
  const { key } = await context.params;
  const object = await bucket.get(key);
  if (!object) return new Response("Poster not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}

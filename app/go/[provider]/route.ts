import { env } from "cloudflare:workers";

type AffiliateEnv = {
  AMAZON_ASSOCIATE_TAG?: string;
  APPLE_AFFILIATE_TOKEN?: string;
  FANDANGO_AFFILIATE_ID?: string;
};

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const title = new URL(request.url).searchParams.get("title")?.trim() || "movies";
  const affiliate = env as unknown as AffiliateEnv;
  const encoded = encodeURIComponent(`${title} movie`);
  const destinations: Record<string, string> = {
    amazon: `https://www.amazon.com/s?k=${encoded}&i=instant-video${affiliate.AMAZON_ASSOCIATE_TAG ? `&tag=${encodeURIComponent(affiliate.AMAZON_ASSOCIATE_TAG)}` : ""}`,
    apple: `https://tv.apple.com/search?term=${encoded}${affiliate.APPLE_AFFILIATE_TOKEN ? `&at=${encodeURIComponent(affiliate.APPLE_AFFILIATE_TOKEN)}&ct=wills-reel-deal` : ""}`,
    netflix: `https://www.netflix.com/search?q=${encodeURIComponent(title)}`,
    fandango: `https://www.fandango.com/search?q=${encodeURIComponent(title)}${affiliate.FANDANGO_AFFILIATE_ID ? `&cmp=${encodeURIComponent(affiliate.FANDANGO_AFFILIATE_ID)}` : ""}`,
  };
  return Response.redirect(destinations[provider] ?? "/", 302);
}

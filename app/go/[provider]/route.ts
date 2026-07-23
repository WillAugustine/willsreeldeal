import { env } from "cloudflare:workers";
import { getWatchListing } from "../../watch-catalog";

type AffiliateEnv = {
  AMAZON_ASSOCIATE_TAG?: string;
  APPLE_AFFILIATE_TOKEN?: string;
};

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const requestUrl = new URL(request.url);
  const title = requestUrl.searchParams.get("title")?.trim() || "";
  const year = requestUrl.searchParams.get("year")?.trim() || "";
  const listing = getWatchListing(title, year);
  if (!listing) return Response.redirect(new URL("/", request.url), 302);

  const affiliate = env as unknown as AffiliateEnv;
  if (provider === "amazon" && (listing.amazonId || listing.amazonQuery)) {
    const amazon = listing.amazonId
      ? new URL(`https://www.amazon.com/gp/video/detail/${listing.amazonId}/ref=nosim`)
      : new URL("https://www.amazon.com/s");
    if (listing.amazonQuery) {
      amazon.searchParams.set("k", listing.amazonQuery);
      amazon.searchParams.set("i", "instant-video");
    }
    amazon.searchParams.set("tag", affiliate.AMAZON_ASSOCIATE_TAG || "willsreeldeal-20");
    return Response.redirect(amazon, 302);
  }

  if (provider === "apple" && listing.appleUrl) {
    const apple = new URL(listing.appleUrl);
    if (affiliate.APPLE_AFFILIATE_TOKEN) {
      apple.searchParams.set("at", affiliate.APPLE_AFFILIATE_TOKEN);
      apple.searchParams.set("ct", "wills-reel-deal");
    }
    return Response.redirect(apple, 302);
  }

  return Response.redirect(new URL("/", request.url), 302);
}

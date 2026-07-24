import { env } from "cloudflare:workers";
import { getWatchListing } from "../../watch-catalog";

type AffiliateEnv = {
  DB?: D1Database;
  AMAZON_ASSOCIATE_TAG?: string;
  APPLE_AFFILIATE_TOKEN?: string;
};

type SavedWatchLinks = {
  amazon_url: string;
  apple_url: string;
};

async function getSavedWatchLinks(db: D1Database | undefined, review: string) {
  const match = review.match(/^review-(\d+)$/);
  if (!db || !match) return null;
  try {
    return await db.prepare("SELECT amazon_url, apple_url FROM reviews WHERE id = ?")
      .bind(Number(match[1]))
      .first<SavedWatchLinks>();
  } catch {
    return null;
  }
}

function isAllowedProviderUrl(url: URL, provider: "amazon" | "apple") {
  if (url.protocol !== "https:") return false;
  if (provider === "amazon") return url.hostname === "amazon.com" || url.hostname.endsWith(".amazon.com");
  return url.hostname === "tv.apple.com" || url.hostname === "itunes.apple.com";
}

function parseProviderUrl(value: string, provider: "amazon" | "apple") {
  try {
    const url = new URL(value);
    return isAllowedProviderUrl(url, provider) ? url : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const requestUrl = new URL(request.url);
  const title = requestUrl.searchParams.get("title")?.trim().slice(0, 120) || "";
  const year = requestUrl.searchParams.get("year")?.trim().slice(0, 4) || "";
  const review = requestUrl.searchParams.get("review")?.trim() || "";
  if (!title) return Response.redirect(new URL("/", request.url), 302);

  const affiliate = env as unknown as AffiliateEnv;
  const savedReview = review.startsWith("review-");
  const savedLinks = savedReview ? await getSavedWatchLinks(affiliate.DB, review) : null;
  const listing = getWatchListing(title, year);

  if (provider === "amazon") {
    let amazon: URL;
    if (savedLinks?.amazon_url) {
      const savedAmazon = parseProviderUrl(savedLinks.amazon_url, "amazon");
      if (!savedAmazon) return Response.redirect(new URL("/", request.url), 302);
      amazon = savedAmazon;
    } else if (listing?.amazonId) {
      amazon = new URL(`https://www.amazon.com/gp/video/detail/${listing.amazonId}/ref=nosim`);
    } else if (listing?.amazonQuery) {
      amazon = new URL("https://www.amazon.com/s");
      amazon.searchParams.set("k", listing.amazonQuery);
      amazon.searchParams.set("i", "instant-video");
    } else {
      return Response.redirect(new URL("/", request.url), 302);
    }
    amazon.searchParams.set("tag", affiliate.AMAZON_ASSOCIATE_TAG || "willsreeldeal-20");
    return Response.redirect(amazon, 302);
  }

  if (provider === "apple") {
    const appleUrl = savedLinks?.apple_url || listing?.appleUrl;
    if (!appleUrl) return Response.redirect(new URL("/", request.url), 302);
    const apple = parseProviderUrl(appleUrl, "apple");
    if (!apple) return Response.redirect(new URL("/", request.url), 302);
    if (affiliate.APPLE_AFFILIATE_TOKEN) {
      apple.searchParams.set("at", affiliate.APPLE_AFFILIATE_TOKEN);
      apple.searchParams.set("ct", "wills-reel-deal");
    }
    return Response.redirect(apple, 302);
  }

  return Response.redirect(new URL("/", request.url), 302);
}

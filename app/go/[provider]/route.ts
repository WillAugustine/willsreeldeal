import { env } from "cloudflare:workers";
import { getWatchListing } from "../../watch-catalog";

type AffiliateEnv = {
  AMAZON_ASSOCIATE_TAG?: string;
  APPLE_AFFILIATE_TOKEN?: string;
};

type AppleMovie = {
  trackName?: string;
  releaseDate?: string;
  trackViewUrl?: string;
  trackPrice?: number;
  trackRentalPrice?: number;
};

function cleanTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isAvailableToRentOrBuy(movie: AppleMovie) {
  return [movie.trackPrice, movie.trackRentalPrice]
    .some((price) => typeof price === "number" && Number.isFinite(price) && price >= 0);
}

async function findAppleMovie(title: string, year: string) {
  const params = new URLSearchParams({
    term: `${title} ${year}`.trim(),
    country: "US",
    media: "movie",
    entity: "movie",
    limit: "25",
  });

  try {
    const response = await fetch(`https://itunes.apple.com/search?${params}`, {
      headers: { Accept: "application/json", "User-Agent": "WillsReelDeal/1.0" },
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) return "";

    const data = await response.json() as { results?: AppleMovie[] };
    const matchingTitle = (data.results ?? []).filter((movie) =>
      movie.trackViewUrl &&
      cleanTitle(movie.trackName ?? "") === cleanTitle(title) &&
      isAvailableToRentOrBuy(movie)
    );
    const matchingYear = matchingTitle.find((movie) => movie.releaseDate?.slice(0, 4) === year);
    return matchingYear?.trackViewUrl ?? matchingTitle[0]?.trackViewUrl ?? "";
  } catch {
    return "";
  }
}

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const requestUrl = new URL(request.url);
  const title = requestUrl.searchParams.get("title")?.trim().slice(0, 120) || "";
  const year = requestUrl.searchParams.get("year")?.trim().slice(0, 4) || "";
  if (!title) return Response.redirect(new URL("/", request.url), 302);

  const listing = getWatchListing(title, year);
  const affiliate = env as unknown as AffiliateEnv;
  if (provider === "amazon") {
    const amazon = listing?.amazonId
      ? new URL(`https://www.amazon.com/gp/video/detail/${listing.amazonId}/ref=nosim`)
      : new URL("https://www.amazon.com/s");
    if (!listing?.amazonId) {
      amazon.searchParams.set("k", listing?.amazonQuery || `${title} ${year} movie`.trim());
      amazon.searchParams.set("i", "instant-video");
    }
    amazon.searchParams.set("tag", affiliate.AMAZON_ASSOCIATE_TAG || "willsreeldeal-20");
    return Response.redirect(amazon, 302);
  }

  if (provider === "apple") {
    const appleUrl = listing?.appleUrl || await findAppleMovie(title, year);
    if (!appleUrl) return Response.redirect(new URL("/", request.url), 302);

    const apple = new URL(appleUrl);
    if (affiliate.APPLE_AFFILIATE_TOKEN) {
      apple.searchParams.set("at", affiliate.APPLE_AFFILIATE_TOKEN);
      apple.searchParams.set("ct", "wills-reel-deal");
    }
    return Response.redirect(apple, 302);
  }

  return Response.redirect(new URL("/", request.url), 302);
}

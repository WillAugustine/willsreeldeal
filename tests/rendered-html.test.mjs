import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("keeps poster selection inside Will's review studio", async () => {
  const [home, studio] = await Promise.all([
    source("app/page.tsx"),
    source("app/studio/StudioForm.tsx"),
  ]);

  assert.doesNotMatch(home, /poster-picker|Choose poster|Pick this poster/i);
  assert.match(home, /fetch\("\/api\/reviews"\)/);
  assert.match(studio, /type="file"/);
  assert.match(studio, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(studio, /fetch\("\/studio\/api\/reviews", \{ method: editingId \? "PUT" : "POST"/);
});

test("uses a typo-proof genre checklist for new reviews", async () => {
  const [studio, genres, route] = await Promise.all([
    source("app/studio/StudioForm.tsx"),
    source("app/genres.ts"),
    source("app/studio/api/reviews/route.ts"),
  ]);

  assert.match(studio, /REVIEW_GENRES\.map/);
  assert.match(studio, /type="checkbox"/);
  assert.match(studio, /formatReviewGenres\(selectedGenres\)/);
  assert.doesNotMatch(studio, /name="genre" placeholder/);
  assert.match(genres, /"Science Fiction"/);
  assert.match(route, /parseReviewGenres/);
});

test("auto-populates runtime from the selected movie", async () => {
  const [searchRoute, studio] = await Promise.all([
    source("app/api/movies/search/route.ts"),
    source("app/studio/StudioForm.tsx"),
  ]);

  assert.match(searchRoute, /wdt:P2047 \?duration/);
  assert.match(searchRoute, /runtime: Number\.isInteger\(minutes\)/);
  assert.match(studio, /setRuntime\(movie\.runtime \? String\(movie\.runtime\) : ""\)/);
  assert.match(studio, /Runtime <span>Auto-filled<\/span>/);
  assert.match(studio, /form\.set\("runtime", runtime\)/);
});

test("replaces review numbers with auto-filled movie content ratings", async () => {
  const [searchRoute, studio, studioRoute, publicRoute, home, styles, schema, migration] = await Promise.all([
    source("app/api/movies/search/route.ts"),
    source("app/studio/StudioForm.tsx"),
    source("app/studio/api/reviews/route.ts"),
    source("app/api/reviews/route.ts"),
    source("app/page.tsx"),
    source("app/globals.css"),
    source("db/schema.ts"),
    source("drizzle/0005_melodic_lethal_legion.sql"),
  ]);

  assert.match(searchRoute, /contentAdvisoryRating/);
  assert.match(searchRoute, /wdt:P1657 \?contentRating/);
  assert.match(studio, /setContentRating\(movie\.contentRating \?\? ""\)/);
  assert.match(studio, /Movie rating <span>Auto-filled<\/span>/);
  assert.match(studio, /form\.set\("contentRating", contentRating\)/);
  assert.match(studioRoute, /content_rating/);
  assert.match(publicRoute, /contentRating: row\.content_rating/);
  assert.match(home, /className="content-rating-badge"/);
  assert.match(home, /\{movie\.contentRating \|\| "NR"\}/);
  assert.doesNotMatch(home, /className="card-number"/);
  assert.match(styles, /\.content-rating-badge/);
  assert.match(schema, /contentRating: text\("content_rating"\)/);
  assert.match(migration, /ADD `content_rating`/);
});

test("lets Will edit previously published studio reviews", async () => {
  const [studio, route, styles] = await Promise.all([
    source("app/studio/StudioForm.tsx"),
    source("app/studio/api/reviews/route.ts"),
    source("app/globals.css"),
  ]);

  assert.match(studio, /Published reviews/);
  assert.match(studio, /fetch\("\/studio\/api\/reviews"\)/);
  assert.match(studio, /method: editingId \? "PUT" : "POST"/);
  assert.match(studio, /required=\{!editingId\}/);
  assert.match(studio, /Save the tune-up/);
  assert.match(route, /export async function GET\(\)/);
  assert.match(route, /export async function PUT\(request: Request\)/);
  assert.match(route, /UPDATE reviews SET/);
  assert.match(route, /fallbackReviews\.find/);
  assert.match(route, /posterContentType = replacementPoster\?\.type \|\| "external\/url"/);
  assert.match(route, /replacementPosterKey \|\| existing\.poster_key/);
  assert.match(styles, /\.studio-review-library/);
});

test("supports an optional favorite movie quote", async () => {
  const [studio, studioRoute, publicRoute, home, newsletter, schema, migration] = await Promise.all([
    source("app/studio/StudioForm.tsx"),
    source("app/studio/api/reviews/route.ts"),
    source("app/api/reviews/route.ts"),
    source("app/page.tsx"),
    source("app/newsletter-service.ts"),
    source("db/schema.ts"),
    source("drizzle/0003_gorgeous_ezekiel_stane.sql"),
  ]);

  assert.match(studio, /Favorite movie quote <span>Optional<\/span>/);
  assert.match(studio, /name="favoriteQuote"/);
  assert.doesNotMatch(studio, /name="favoriteQuote"[^>]*required/);
  assert.match(studioRoute, /favorite_quote/);
  assert.match(studioRoute, /fields\.favoriteQuote/);
  assert.match(publicRoute, /favoriteQuote: row\.favorite_quote/);
  assert.match(home, /movie\.favoriteQuote && <blockquote className="favorite-quote"/);
  assert.match(newsletter, /review\.favorite_quote \?/);
  assert.match(schema, /favoriteQuote: text\("favorite_quote"\)/);
  assert.match(migration, /ALTER TABLE `reviews` ADD `favorite_quote`/);
});

test("captures the selected couch-experience details", async () => {
  const [studio, studioRoute, publicRoute, home, newsletter, experience, schema, migration] = await Promise.all([
    source("app/studio/StudioForm.tsx"),
    source("app/studio/api/reviews/route.ts"),
    source("app/api/reviews/route.ts"),
    source("app/page.tsx"),
    source("app/newsletter-service.ts"),
    source("app/review-experience.ts"),
    source("db/schema.ts"),
    source("drizzle/0004_equal_mephisto.sql"),
  ]);

  assert.match(experience, /"Annual tradition"/);
  assert.match(experience, /"Never again",\s+"Probably not",\s+"Maybe someday"/);
  assert.match(experience, /"Full theater"/);
  assert.match(experience, /"Lost the battle"/);
  assert.match(studio, /Rewatch Odds/);
  assert.match(studio, /Ideal Watch Party/);
  assert.match(studio, /Sleep Risk/);
  assert.match(studio, /form\.set\("watchParty", formatWatchParties\(watchParties\)\)/);
  assert.match(studio, /aria-pressed=\{selectedOption\}/);
  assert.match(studioRoute, /canonicalChoice\(textField\(form, "rewatchOdds"\), REWATCH_ODDS\)/);
  assert.match(studioRoute, /formatWatchParties\(parseWatchParties\(textField\(form, "watchParty"\)\)\)/);
  assert.match(publicRoute, /sleepRisk: row\.sleep_risk/);
  assert.match(home, /className="couch-stats"/);
  assert.match(newsletter, /review\.rewatch_odds \|\| review\.watch_party \|\| review\.sleep_risk/);
  assert.match(schema, /rewatchOdds: text\("rewatch_odds"\)/);
  assert.match(schema, /watchParty: text\("watch_party"\)/);
  assert.match(schema, /sleepRisk: text\("sleep_risk"\)/);
  assert.match(migration, /ADD `rewatch_odds`/);
  assert.match(migration, /ADD `watch_party`/);
  assert.match(migration, /ADD `sleep_risk`/);
});

test("configures persistent review records and poster storage", async () => {
  const [schema, route, config, auth] = await Promise.all([
    source("db/schema.ts"),
    source("app/studio/api/reviews/route.ts"),
    source("wrangler.jsonc"),
    source("app/studio-auth.ts"),
  ]);

  assert.match(schema, /sqliteTable\("reviews"/);
  assert.match(route, /bucket\.put/);
  assert.match(route, /storePoster\(runtimeEnv\.POSTERS/);
  assert.match(route, /movieId.*title/s);
  const wrangler = JSON.parse(config);
  assert.equal(wrangler.d1_databases[0].binding, "DB");
  assert.equal(wrangler.r2_buckets[0].binding, "POSTERS");
  assert.equal(wrangler.vars.STUDIO_OWNER_EMAIL, "willaugustine64@outlook.com");
  assert.match(auth, /cf-access-authenticated-user-email/);
  assert.match(auth, /STUDIO_OWNER_EMAIL/);
});

test("contains no em dashes in visitor or studio copy", async () => {
  const files = await Promise.all([
    source("app/page.tsx"),
    source("app/studio/page.tsx"),
    source("app/studio/StudioForm.tsx"),
  ]);
  for (const file of files) assert.doesNotMatch(file, /\u2014/);
});

test("uses real Letterboxd reviews without Netflix links", async () => {
  const [home, catalog, affiliateRoute] = await Promise.all([
    source("app/page.tsx"),
    source("app/review-catalog.ts"),
    source("app/go/[provider]/route.ts"),
  ]);

  assert.match(home, /letterboxd\.com\/foodiefrank/);
  assert.match(catalog, /title: "I Swear"/);
  assert.match(catalog, /title: "The Batman"/);
  assert.match(catalog, /title: "Jurassic Park"/);
  assert.match(catalog, /title: "Chef"/);
  assert.match(catalog, /title: "Stuck on You"/);
  assert.doesNotMatch(home, /netflix/i);
  assert.doesNotMatch(affiliateRoute, /netflix/i);
});

test("shows decimal ratings, the 1-10 scale, and the latest-watch label", async () => {
  const [home, catalog] = await Promise.all([
    source("app/page.tsx"),
    source("app/review-catalog.ts"),
  ]);

  assert.match(home, /Will’s latest watch/);
  assert.doesNotMatch(home, /Will’s pick of the week/);
  assert.match(catalog, /rating: 9\.2/);
  assert.match(catalog, /rating: 7\.8/);
  assert.match(home, /rating\.toFixed\(1\)/);
  assert.match(home, /\["1", "Abysmal"/);
  assert.match(home, /\["10", "Masterpiece"/);
  assert.match(home, /What every number actually means/);
});

test("shows only verified rent or buy links and tags Amazon automatically", async () => {
  const [home, affiliateRoute, catalog, studio, studioRoute, publicRoute, schema] = await Promise.all([
    source("app/page.tsx"),
    source("app/go/[provider]/route.ts"),
    source("app/watch-catalog.ts"),
    source("app/studio/StudioForm.tsx"),
    source("app/studio/api/reviews/route.ts"),
    source("app/api/reviews/route.ts"),
    source("db/schema.ts"),
  ]);

  assert.match(home, /savedReview\s*\?\s*Boolean\(movie\.amazonUrl\)/);
  assert.match(home, /savedReview \? Boolean\(movie\.appleUrl\)/);
  assert.match(home, /if \(!hasAmazon && !hasApple\) return null/);
  assert.match(home, /\{hasAmazon && <a href=\{`\/go\/amazon\$\{query\}`\}/);
  assert.match(home, /\{hasApple && <a href=\{`\/go\/apple\$\{query\}`\}/);
  assert.match(affiliateRoute, /willsreeldeal-20/);
  assert.match(affiliateRoute, /gp\/video\/detail/);
  assert.match(affiliateRoute, /SELECT amazon_url, apple_url FROM reviews WHERE id = \?/);
  assert.match(affiliateRoute, /if \(!savedLinks\?\.amazon_url\)/);
  assert.match(affiliateRoute, /if \(!appleUrl\)/);
  assert.doesNotMatch(affiliateRoute, /itunes\.apple\.com\/search/i);
  assert.doesNotMatch(affiliateRoute, /tv\.apple\.com\/us\/search/);
  assert.match(studio, /name="amazonUrl"/);
  assert.match(studio, /name="appleUrl"/);
  assert.match(studio, /A blank field keeps that button hidden/);
  assert.match(studioRoute, /amazon_url, apple_url/);
  assert.match(publicRoute, /amazonUrl: row\.amazon_url/);
  assert.match(schema, /amazonUrl: text\("amazon_url"\)/);
  assert.match(schema, /appleUrl: text\("apple_url"\)/);
  assert.match(catalog, /0UAG2NRWRJA02MMHU02N5RX8WR/);
  assert.match(catalog, /tv\.apple\.com\/us\/movie\/i-swear/);
  assert.doesNotMatch(catalog, /movieKey\("Palm Springs", "2020"\)/);
});

test("starts the request leaderboard empty without demo vote seeding", async () => {
  const [home, community] = await Promise.all([
    source("app/page.tsx"),
    source("app/api/community/route.ts"),
  ]);

  assert.match(home, /useState<Leader\[\]>\(\[\]\)/);
  assert.match(home, /Be the first to pester Will/);
  assert.doesNotMatch(community, /INSERT OR IGNORE INTO movie_requests/);
});

test("searches a broad live movie catalog with partial matches and poster art", async () => {
  const [home, searchRoute, styles] = await Promise.all([
    source("app/page.tsx"),
    source("app/api/movies/search/route.ts"),
    source("app/globals.css"),
  ]);

  assert.match(searchRoute, /v3\.sg\.media-imdb\.com\/suggestion/);
  assert.match(searchRoute, /parseSearch\(rawQuery\)/);
  assert.match(searchRoute, /clean\(movie\.title\)\.includes\(normalizedQuery\)/);
  assert.match(searchRoute, /OPTIONAL \{ \?item wdt:P18 \?image\. \}/);
  assert.match(searchRoute, /poster: item\.i\?\.imageUrl/);
  assert.match(home, /movie\.poster \? <img src=\{movie\.poster\}/);
  assert.match(home, /aria-hidden="true">🎬/);
  assert.match(styles, /\.search-result-art--poster/);
  assert.doesNotMatch(home, /<span className="result-dot" \/> <strong>\{movie\.title\}/);
});

test("connects Reel Mail to Resend with both delivery schedules", async () => {
  const [newsletter, publishRoute, worker, config] = await Promise.all([
    source("app/newsletter-service.ts"),
    source("app/studio/api/reviews/route.ts"),
    source("worker/index.ts"),
    source("wrangler.jsonc"),
  ]);

  assert.match(newsletter, /https:\/\/api\.resend\.com/);
  assert.match(newsletter, /Every New Review/);
  assert.match(newsletter, /Double Feature Digest/);
  assert.match(newsletter, /RESEND_UNSUBSCRIBE_URL/);
  assert.match(newsletter, /body: JSON\.stringify\(topics\)/);
  assert.doesNotMatch(newsletter, /body: JSON\.stringify\(\{ topics \}\)/);
  assert.match(newsletter, /sendInstantReview/);
  assert.match(newsletter, /sendBiweeklyDigest/);
  assert.match(publishRoute, /sendInstantReview/);
  assert.match(worker, /async scheduled/);
  assert.match(worker, /sendBiweeklyDigest/);
  const wrangler = JSON.parse(config);
  assert.deepEqual(wrangler.triggers.crons, ["0 17 * * FRI"]);
  assert.equal(wrangler.vars.NEWSLETTER_SITE_URL, "https://willsreeldeal.com");
});

test("builds personal suggestions only from Will's reviewed movies", async () => {
  const home = await source("app/page.tsx");

  assert.match(home, /watchedPool = withinRuntime\.length \? withinRuntime : reviews/);
  assert.match(home, /Every suggestion comes only from movies I have actually watched and reviewed/);
  assert.match(home, /Will’s picks for tonight/);
  assert.doesNotMatch(home, /const moodMovies/);
  assert.doesNotMatch(home, /title: "Palm Springs"/);
});

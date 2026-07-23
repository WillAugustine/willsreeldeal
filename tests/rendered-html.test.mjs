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
  assert.match(studio, /fetch\("\/studio\/api\/reviews", \{ method: "POST"/);
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

test("configures persistent review records and poster storage", async () => {
  const [schema, route, config, auth] = await Promise.all([
    source("db/schema.ts"),
    source("app/studio/api/reviews/route.ts"),
    source("wrangler.jsonc"),
    source("app/studio-auth.ts"),
  ]);

  assert.match(schema, /sqliteTable\("reviews"/);
  assert.match(route, /POSTERS\.put/);
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
  const [home, affiliateRoute] = await Promise.all([
    source("app/page.tsx"),
    source("app/go/[provider]/route.ts"),
  ]);

  assert.match(home, /letterboxd\.com\/foodiefrank/);
  assert.match(home, /title: "I Swear"/);
  assert.match(home, /title: "The Batman"/);
  assert.match(home, /title: "Jurassic Park"/);
  assert.match(home, /title: "Chef"/);
  assert.match(home, /title: "Stuck on You"/);
  assert.doesNotMatch(home, /netflix/i);
  assert.doesNotMatch(affiliateRoute, /netflix/i);
});

test("shows decimal ratings, the 1-10 scale, and the latest-watch label", async () => {
  const home = await source("app/page.tsx");

  assert.match(home, /Will’s latest watch/);
  assert.doesNotMatch(home, /Will’s pick of the week/);
  assert.match(home, /rating: 9\.2/);
  assert.match(home, /rating: 7\.8/);
  assert.match(home, /rating\.toFixed\(1\)/);
  assert.match(home, /\["1", "Abysmal"/);
  assert.match(home, /\["10", "Masterpiece"/);
  assert.match(home, /What every number actually means/);
});

test("uses verified movie destinations and the Amazon Associates tag", async () => {
  const [home, affiliateRoute, catalog] = await Promise.all([
    source("app/page.tsx"),
    source("app/go/[provider]/route.ts"),
    source("app/watch-catalog.ts"),
  ]);

  assert.match(home, /getWatchListing\(movie\.title, movie\.year\)/);
  assert.match(affiliateRoute, /willsreeldeal-20/);
  assert.match(affiliateRoute, /gp\/video\/detail/);
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

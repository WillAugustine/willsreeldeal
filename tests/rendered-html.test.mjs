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
  assert.match(auth, /cf-access-authenticated-user-email/);
  assert.match(auth, /STUDIO_OWNER_EMAIL/);
});

test("contains no em dashes in visitor or studio copy", async () => {
  const files = await Promise.all([
    source("app/page.tsx"),
    source("app/studio/page.tsx"),
    source("app/studio/StudioForm.tsx"),
  ]);
  for (const file of files) assert.doesNotMatch(file, /—/);
});

test("uses real Letterboxd reviews without Netflix links", async () => {
  const [home, affiliateRoute] = await Promise.all([
    source("app/page.tsx"),
    source("app/go/[provider]/route.ts"),
  ]);

  assert.match(home, /letterboxd\.com\/foodiefrank/);
  assert.match(home, /title: "I Swear"/);
  assert.match(home, /title: "The Batman"/);
  assert.doesNotMatch(home, /netflix/i);
  assert.doesNotMatch(affiliateRoute, /netflix/i);
});

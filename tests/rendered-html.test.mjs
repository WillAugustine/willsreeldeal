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
  assert.match(studio, /fetch\("\/api\/reviews", \{ method: "POST"/);
});

test("configures persistent review records and poster storage", async () => {
  const [schema, route, hosting] = await Promise.all([
    source("db/schema.ts"),
    source("app/api/reviews/route.ts"),
    source(".openai/hosting.json"),
  ]);

  assert.match(schema, /sqliteTable\("reviews"/);
  assert.match(schema, /sqliteTable\("studio_owner"/);
  assert.match(route, /POSTERS\.put/);
  assert.match(route, /movieId.*title/s);
  assert.equal(JSON.parse(hosting).r2, "POSTERS");
});

test("contains no em dashes in visitor or studio copy", async () => {
  const files = await Promise.all([
    source("app/page.tsx"),
    source("app/studio/page.tsx"),
    source("app/studio/StudioForm.tsx"),
  ]);
  for (const file of files) assert.doesNotMatch(file, /—/);
});

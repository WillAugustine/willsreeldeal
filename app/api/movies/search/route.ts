type MovieResult = {
  id: string;
  title: string;
  year: string;
  runtime: number | null;
  poster?: string;
};

type ImdbSuggestion = {
  id?: string;
  l?: string;
  y?: number;
  q?: string;
  qid?: string;
  i?: { imageUrl?: string };
};

type WikidataBinding = {
  item: { value: string };
  itemLabel: { value: string };
  date?: { value: string };
  duration?: { value: string };
  image?: { value: string };
};

const fallbackMovies: MovieResult[] = [
  ["Q25188", "The Matrix", "1999", 136], ["Q134773", "Barbie", "2023", 114], ["Q103474", "The Godfather", "1972", 175],
  ["Q44578", "Inception", "2010", 148], ["Q17738", "The Grand Budapest Hotel", "2014", 100], ["Q104123", "Parasite", "2019", 132],
  ["Q189330", "Interstellar", "2014", 169], ["Q166262", "Spirited Away", "2001", 125], ["Q23781129", "Everything Everywhere All at Once", "2022", 140],
  ["Q232009", "The Princess Bride", "1987", 98], ["Q220741", "Jurassic Park", "1993", 127], ["Q182692", "Moonlight", "2016", 111],
].map(([id, title, year, runtime]) => ({ id: String(id), title: String(title), year: String(year), runtime: Number(runtime) }));

function clean(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseSearch(rawQuery: string) {
  const yearMatch = rawQuery.match(/(?:\(|\s)(19|20)\d{2}\)?\s*$/);
  const requestedYear = yearMatch?.[0].match(/\d{4}/)?.[0] ?? "";
  const titleQuery = rawQuery
    .replace(/(?:\(|\s)(?:19|20)\d{2}\)?\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return { titleQuery: titleQuery || rawQuery, requestedYear };
}

function movieScore(movie: MovieResult, titleQuery: string, requestedYear: string) {
  const title = clean(movie.title);
  const query = clean(titleQuery);
  return (
    (title === query ? 100 : 0) +
    (title.startsWith(query) ? 50 : 0) +
    (title.includes(query) ? 25 : 0) +
    (requestedYear && movie.year === requestedYear ? 20 : 0)
  );
}

async function searchImdb(titleQuery: string): Promise<MovieResult[]> {
  const response = await fetch(`https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(titleQuery)}.json`, {
    headers: { Accept: "application/json", "User-Agent": "WillsReelDeal/1.0" },
    signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) throw new Error("IMDb catalog unavailable");
  const data = await response.json() as { d?: ImdbSuggestion[] };

  return (data.d ?? [])
    .filter((item) => {
      const kind = `${item.q ?? ""} ${item.qid ?? ""}`.toLowerCase();
      return item.id?.startsWith("tt") &&
        typeof item.l === "string" &&
        !/(tv series|tv mini|tv episode|podcast|video game|music video)/.test(kind);
    })
    .map((item) => ({
      id: item.id as string,
      title: item.l as string,
      year: item.y ? String(item.y) : "",
      runtime: null,
      poster: item.i?.imageUrl,
    }));
}

function commonsPoster(imageUrl?: string) {
  if (!imageUrl) return undefined;
  const filename = decodeURIComponent(imageUrl.split("/").pop() ?? "");
  return filename
    ? `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(filename)}?width=160`
    : undefined;
}

async function searchWikidata(titleQuery: string): Promise<MovieResult[]> {
  const sparql = `
    SELECT DISTINCT ?item ?itemLabel ?date ?duration ?image WHERE {
      SERVICE wikibase:mwapi {
        bd:serviceParam wikibase:endpoint "www.wikidata.org";
          wikibase:api "EntitySearch";
          mwapi:search "${titleQuery.replace(/["\\]/g, " ")}";
          mwapi:language "en";
          mwapi:limit "40".
        ?item wikibase:apiOutputItem mwapi:item.
      }
      ?item wdt:P31/wdt:P279* wd:Q11424.
      OPTIONAL { ?item wdt:P577 ?date. }
      OPTIONAL { ?item wdt:P2047 ?duration. }
      OPTIONAL { ?item wdt:P18 ?image. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 30`;

  const response = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`, {
    headers: { Accept: "application/sparql-results+json", "User-Agent": "WillsReelDeal/1.0" },
    signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) throw new Error("Wikidata catalog unavailable");
  const data = await response.json() as { results: { bindings: WikidataBinding[] } };
  const byId = new Map<string, MovieResult>();

  for (const row of data.results.bindings) {
    const id = row.item.value.split("/").pop() ?? row.item.value;
    const minutes = Math.round(Number(row.duration?.value));
    const movie = {
      id,
      title: row.itemLabel.value,
      year: row.date?.value?.slice(0, 4) ?? "",
      runtime: Number.isInteger(minutes) && minutes >= 1 && minutes <= 600 ? minutes : null,
      poster: commonsPoster(row.image?.value),
    };
    const current = byId.get(id);
    if (!current) {
      byId.set(id, movie);
      continue;
    }
    if (movie.year && (!current.year || movie.year < current.year)) current.year = movie.year;
    if (movie.runtime && (!current.runtime || movie.runtime < current.runtime)) current.runtime = movie.runtime;
    if (!current.poster && movie.poster) current.poster = movie.poster;
  }
  return Array.from(byId.values());
}

export async function GET(request: Request) {
  const rawQuery = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (rawQuery.length < 2) return Response.json({ movies: [] });

  const { titleQuery, requestedYear } = parseSearch(rawQuery);
  const searches = await Promise.allSettled([
    searchImdb(titleQuery),
    searchWikidata(titleQuery),
  ]);
  const candidates = searches.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const normalizedQuery = clean(titleQuery);
  const unique = new Map<string, MovieResult>();

  for (const movie of candidates) {
    if (!clean(movie.title).includes(normalizedQuery)) continue;
    const key = `${clean(movie.title)}|${movie.year}`;
    const current = unique.get(key);
    unique.set(key, current ? {
      ...current,
      runtime: current.runtime ?? movie.runtime,
      poster: current.poster ?? movie.poster,
    } : movie);
  }

  const movies = Array.from(unique.values())
    .sort((a, b) => movieScore(b, titleQuery, requestedYear) - movieScore(a, titleQuery, requestedYear) || b.year.localeCompare(a.year))
    .slice(0, 12);

  if (movies.length) {
    return Response.json(
      { movies, source: searches[0].status === "fulfilled" ? "IMDb and Wikidata" : "Wikidata" },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  }

  const fallback = fallbackMovies
    .filter((movie) => clean(movie.title).includes(normalizedQuery))
    .sort((a, b) => movieScore(b, titleQuery, requestedYear) - movieScore(a, titleQuery, requestedYear))
    .slice(0, 12);
  return Response.json({ movies: fallback, source: "fallback" });
}

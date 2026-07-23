const fallbackMovies = [
  ["Q25188", "The Matrix", "1999", 136], ["Q134773", "Barbie", "2023", 114], ["Q103474", "The Godfather", "1972", 175],
  ["Q44578", "Inception", "2010", 148], ["Q17738", "The Grand Budapest Hotel", "2014", 100], ["Q104123", "Parasite", "2019", 132],
  ["Q189330", "Interstellar", "2014", 169], ["Q166262", "Spirited Away", "2001", 125], ["Q23781129", "Everything Everywhere All at Once", "2022", 140],
  ["Q232009", "The Princess Bride", "1987", 98], ["Q220741", "Jurassic Park", "1993", 127], ["Q182692", "Moonlight", "2016", 111],
].map(([id, title, year, runtime]) => ({ id: String(id), title: String(title), year: String(year), runtime: Number(runtime) }));

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ movies: [] });

  const sparql = `
    SELECT DISTINCT ?item ?itemLabel ?date ?duration WHERE {
      SERVICE wikibase:mwapi {
        bd:serviceParam wikibase:endpoint "www.wikidata.org";
          wikibase:api "EntitySearch";
          mwapi:search "${query.replace(/["\\]/g, " ")}";
          mwapi:language "en";
          mwapi:limit "15".
        ?item wikibase:apiOutputItem mwapi:item.
      }
      ?item wdt:P31/wdt:P279* wd:Q11424.
      OPTIONAL { ?item wdt:P577 ?date. }
      OPTIONAL { ?item wdt:P2047 ?duration. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 8`;

  try {
    const response = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`, {
      headers: { Accept: "application/sparql-results+json", "User-Agent": "WillsReelDeal/1.0" },
    });
    if (!response.ok) throw new Error("Movie catalog unavailable");
    const data = await response.json() as { results: { bindings: Array<{ item: { value: string }; itemLabel: { value: string }; date?: { value: string }; duration?: { value: string } }> } };
    const mapped = data.results.bindings.map((row) => ({
      id: row.item.value.split("/").pop() ?? row.item.value,
      title: row.itemLabel.value,
      year: row.date?.value?.slice(0, 4) ?? "",
      runtime: (() => {
        const minutes = Math.round(Number(row.duration?.value));
        return Number.isInteger(minutes) && minutes >= 1 && minutes <= 600 ? minutes : null;
      })(),
    }));
    const byId = new Map<string, { id: string; title: string; year: string; runtime: number | null }>();
    for (const movie of mapped) {
      const current = byId.get(movie.id);
      if (!current) {
        byId.set(movie.id, movie);
        continue;
      }
      if (movie.year && (!current.year || movie.year < current.year)) current.year = movie.year;
      if (movie.runtime && (!current.runtime || movie.runtime < current.runtime)) current.runtime = movie.runtime;
    }
    const movies = Array.from(byId.values());
    return Response.json({ movies, source: "Wikidata" });
  } catch {
    const normalized = query.toLowerCase();
    return Response.json({ movies: fallbackMovies.filter((movie) => movie.title.toLowerCase().includes(normalized)).slice(0, 8), source: "fallback" });
  }
}

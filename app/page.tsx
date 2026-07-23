"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { REVIEW_GENRES } from "./genres";
import { getWatchListing } from "./watch-catalog";

type Movie = {
  id: string;
  title: string;
  year: string;
  genre?: string;
  runtime?: number;
  vibe?: string;
  color?: string;
  rating?: number;
  blurb?: string;
  reviewText?: string;
  poster?: string;
  letterboxdUrl?: string;
};

type Leader = Movie & { votes: number };

const fallbackReviews: Movie[] = [
  {
    id: "letterboxd-i-swear",
    title: "I Swear",
    year: "2025",
    genre: "History / drama",
    runtime: 121,
    color: "#355245",
    rating: 9.2,
    blurb: "So many emotions, all fueled by a spectacular performance by Robert Aramayo.",
    reviewText: "“Sometimes what I say is funny and I even laugh myself, but that’s very different to actively teasing, or mocking, or encouraging people to swear.”\n\nSo many emotions, all fueled by a spectacular performance by Robert Aramayo. It strikes this balance of a biopic, being informative, but being a damn good movie at the core. It’s super cool that, as an extension of Davidson’s attempt to spread awareness of Tourette’s, this movie was born and executed beautifully.",
    poster: "https://a.ltrbxd.com/resized/alternative-poster/1/1/9/7/8/4/2/p/jm6sHwVMWy1Izk8Mgmjcza6kxMJ-0-600-0-900-crop.jpg?v=3edb3dc630",
    letterboxdUrl: "https://letterboxd.com/foodiefrank/film/i-swear/",
  },
  {
    id: "letterboxd-demolition",
    title: "Demolition",
    year: "2015",
    genre: "Drama / comedy",
    runtime: 101,
    color: "#596451",
    rating: 7.8,
    blurb: "It’s an interesting take on loss and how it can affect you.",
    reviewText: "Although there are some parts that seemingly, in my opinion, don’t mesh well together or belong in the same movie, I enjoyed this. It’s an interesting take on loss and how it can affect you. Not as many raw emotion moments as I would have liked but that is also kind of the point.",
    poster: "https://a.ltrbxd.com/resized/alternative-poster/2/3/0/8/3/2/p/oz5zHHaaQJru31FS5HgLKK6QWA8-0-600-0-900-crop.jpg?v=44e6bab769",
    letterboxdUrl: "https://letterboxd.com/foodiefrank/film/demolition/",
  },
  {
    id: "letterboxd-end-of-watch",
    title: "End of Watch",
    year: "2012",
    genre: "Drama / thriller / crime",
    runtime: 109,
    color: "#4b514a",
    rating: 5.9,
    blurb: "Incredibly tough watch - will not watch again.",
    reviewText: "I wish they either leaned into the self-filmed part all the way or left it out. Why was everyone else filming? It was a slow burn for a while but vital for setting everything up.\n\nIncredibly tough watch - will not watch again.",
    poster: "https://a.ltrbxd.com/resized/film-poster/6/3/4/6/2/63462-end-of-watch-0-600-0-900-crop.jpg?v=da5e26db65",
    letterboxdUrl: "https://letterboxd.com/foodiefrank/film/end-of-watch/",
  },
  {
    id: "letterboxd-invictus",
    title: "Invictus",
    year: "2009",
    genre: "History / drama",
    runtime: 134,
    color: "#755f3f",
    rating: 7.1,
    blurb: "Parts were amazing, parts were meh.",
    reviewText: "Parts were amazing, parts were meh. There are some deeper messages throughout the movie that are powerful and worth a thought. I had a good time learning more about rugby and Nelson Mandela.\n\n#8 of watching every Matt Damon movie in prep for The Odyssey",
    poster: "https://a.ltrbxd.com/resized/film-poster/3/7/6/0/5/37605-invictus-0-600-0-900-crop.jpg?v=4cf7d9e769",
    letterboxdUrl: "https://letterboxd.com/foodiefrank/film/invictus/",
  },
  {
    id: "letterboxd-the-batman",
    title: "The Batman",
    year: "2022",
    genre: "Crime / mystery / thriller",
    runtime: 177,
    color: "#3b3030",
    rating: 9.8,
    blurb: "Still badass.",
    reviewText: "Still badass.",
    poster: "https://a.ltrbxd.com/resized/alternative-poster/3/4/8/9/1/4/p/tdWJFXQZzzI8TIJQ54vLaQ50bW2-0-600-0-900-crop.jpg?v=e5d27db670",
    letterboxdUrl: "https://letterboxd.com/foodiefrank/film/the-batman/",
  },
  {
    id: "letterboxd-the-informant",
    title: "The Informant!",
    year: "2009",
    genre: "Comedy / Crime / Drama",
    runtime: 108,
    color: "#7b713c",
    rating: 6.1,
    blurb: "The plot was interesting and Matt Damon did good, but the comedy gets overplayed.",
    reviewText: "To be fair, I haven’t watched many other Steven Soderbergh films (yet) but I wasn’t a huge fan of the stylistic choices made throughout. The plot was interesting and I do think Matt Damon did good in his role. It has some good comedy pieces but it does overplay the comedy aspect a little IMO.\n\nThe last 10-15 minutes were the best part by far.\n\n#7 of watching every Matt Damon movie in prep for The Odyssey",
    poster: "https://a.ltrbxd.com/resized/alternative-poster/4/5/4/1/0/p/iBCzdj22caOLJaNpOvEmFGt0h02-0-600-0-900-crop.jpg?v=638fcc071a",
    letterboxdUrl: "https://letterboxd.com/foodiefrank/film/the-informant-2009/",
  },
  {
    id: "letterboxd-air",
    title: "Air",
    year: "2023",
    genre: "Drama / history",
    runtime: 112,
    color: "#a8623b",
    rating: 8.2,
    blurb: "It doesn’t focus on MJ, but Nike and the people behind the creation of the Air Jordan brand.",
    reviewText: "“I believe the saying that if you say what you want, that’s fine and good, but doing something about it, now… that’s what really counts”\n\nI think Air works really well because it doesn’t focus on MJ, but Nike and the people behind the creation of the Air Jordan brand. I really like Ben Affleck’s directing style in this and with all of the big names in this, it was set up for success.\n\n#6 of watching every Matt Damon movie in prep for The Odyssey",
    poster: "https://a.ltrbxd.com/resized/alternative-poster/8/6/8/4/9/1/p/iKcnbqhKvlwfF4CnMVlRrYlOvM5-0-600-0-900-crop.jpg?v=781672961f",
    letterboxdUrl: "https://letterboxd.com/foodiefrank/film/air-2023/",
  },
  {
    id: "letterboxd-the-brothers-grimm",
    title: "The Brothers Grimm",
    year: "2005",
    genre: "Adventure / Comedy / Fantasy",
    runtime: 118,
    color: "#584c3d",
    rating: 3.8,
    blurb: "What in the Scooby Doo shit is this?",
    reviewText: "What in the Scooby Doo shit is this? You may think that with a movie where the main actors are Matt Damon and Heath Ledger it’s destined to be good. Wrong. They’re only as good as the writing can make them. It just never grabbed me and I did not love the comedy style the movie was going for.\n\n#5 of watching every Matt Damon movie in prep for The Odyssey",
    poster: "https://a.ltrbxd.com/resized/film-poster/4/9/3/3/3/49333-the-brothers-grimm-0-600-0-900-crop.jpg?v=92a8365d8f",
    letterboxdUrl: "https://letterboxd.com/foodiefrank/film/the-brothers-grimm/",
  },
  {
    id: "letterboxd-jurassic-park",
    title: "Jurassic Park",
    year: "1993",
    genre: "Adventure / Science Fiction / Thriller",
    runtime: 127,
    color: "#574932",
    rating: 9.1,
    blurb: "A classic that still looks so good and completely sucks you into its world.",
    reviewText: "Watching this is 2026 is crazy because it still looks so good. The plot just sucks you in and I didn’t realize how detail-oriented and immersive the world building is. A classic that went on to create a very mediocre franchise.",
    poster: "https://a.ltrbxd.com/resized/alternative-poster/5/1/7/3/3/p/uvQmTMXLWTFxRkbvnLyeBJV1K0w-0-600-0-900-crop.jpg?v=c9fd8f7048",
    letterboxdUrl: "https://letterboxd.com/foodiefrank/film/jurassic-park/",
  },
  {
    id: "letterboxd-chef",
    title: "Chef",
    year: "2014",
    genre: "Comedy / Drama",
    runtime: 114,
    color: "#a45235",
    rating: 9.9,
    blurb: "A masterclass by Jon Favreau. Everything about Chef works for me.",
    reviewText: "A masterclass by Jon Favreau. Everything about Chef works for me. Call me biased as I worked in kitchens all throughout high school and college but Chef is a great story focused around something that unites us all - food.\n\nChef teaches you about food while also delivering this wholesome family-oriented story. The cast speaks for itself with R.D.J., Scarlett Johansson, John Leguizamo, Dustin Hoffman, Sofía Vergara, and many others. It is just perfect.",
    poster: "https://a.ltrbxd.com/resized/alternative-poster/1/5/1/3/0/9/p/iTvTLl7RuFGDlsKmj4tQdCcpOVm-0-600-0-900-crop.jpg?v=163487851b",
    letterboxdUrl: "https://letterboxd.com/foodiefrank/film/chef/",
  },
  {
    id: "letterboxd-the-king",
    title: "The King",
    year: "2019",
    genre: "Drama / History / War",
    runtime: 140,
    color: "#403a31",
    rating: 8.9,
    blurb: "The pacing is slow, but the stunning cinematography more than makes up for it.",
    reviewText: "To preface this review, I’m a massive Joel Edgerton fan.\n\nYes, the pacing can be a little slow. I think this is made up for by the absolutely stunning cinematography though. I don’t think Timothée is great at faking an accent, but he is great at acting. I really enjoyed this throughout and, personally, I think the 2.5 hour runtime was about right to set everything up and really immerse you in this 15th century timepiece.",
    poster: "https://a.ltrbxd.com/resized/alternative-poster/4/3/4/7/5/3/p/igS2oqoK9yqYsyyeSuwJ8tIWEX0-0-600-0-900-crop.jpg?v=45b2b4b792",
    letterboxdUrl: "https://letterboxd.com/foodiefrank/film/the-king-2019/",
  },
  {
    id: "letterboxd-stuck-on-you",
    title: "Stuck on You",
    year: "2003",
    genre: "Comedy",
    runtime: 118,
    color: "#426354",
    rating: 5.8,
    blurb: "It wanted so desperately to be like Step Brothers and barely missed the mark.",
    reviewText: "For a movie that wanted so desperately to be like Step Brothers it just barely missed the mark. The characters aren’t inherently funny but the writing had a chance to make up for that - too bad it fell short.\n\nThe funniest parts of the movie were after they got separated with the clips of them having muscle memory of being together.\n\n#4 of watching every Matt Damon movie in prep for The Odyssey",
    poster: "https://a.ltrbxd.com/resized/alternative-poster/5/0/7/9/0/p/aTy6zNMGNJQYZho3Lcw2OoQQAT5-0-600-0-900-crop.jpg?v=bff51f42b8",
    letterboxdUrl: "https://letterboxd.com/foodiefrank/film/stuck-on-you/",
  },
];

const genreFilters = REVIEW_GENRES;

function matchesGenre(movie: Movie, genre: string) {
  return genre === "Surprise me" || movie.genre?.toLowerCase().includes(genre.toLowerCase());
}

function matchesVibe(movie: Movie, vibe: string) {
  const genres = movie.genre?.toLowerCase() ?? "";
  const vibeGenres: Record<string, string[]> = {
    easy: ["comedy", "animation", "family", "romance"],
    clever: ["mystery", "sci-fi", "science fiction", "crime", "history"],
    chaotic: ["action", "thriller", "horror"],
    cozy: ["animation", "comedy", "romance", "family"],
    intense: ["thriller", "crime", "horror", "drama"],
  };
  return vibeGenres[vibe]?.some((item) => genres.includes(item)) ?? false;
}

function formatRating(rating?: number) {
  return typeof rating === "number" ? rating.toFixed(1) : "NR";
}

function Poster({ movie, compact = false }: { movie: Movie; compact?: boolean }) {
  const artwork = movie.poster;
  return (
    <div className={`poster ${compact ? "poster--compact" : ""} ${artwork ? "poster--art" : ""}`} style={{ "--poster": movie.color ?? "#3d7654" } as CSSProperties}>
      {artwork && <img src={artwork} alt={`Poster for ${movie.title}`} referrerPolicy="no-referrer" />}
      <div className="poster__grain" />
      <span className="poster__year">{movie.year}</span>
      <span className="poster__mark">WRD</span>
      <strong>{movie.title}</strong>
    </div>
  );
}

function WatchLinks({ movie, compact = false }: { movie: Movie; compact?: boolean }) {
  const listing = getWatchListing(movie.title, movie.year);
  if (!listing) return null;
  const query = `?title=${encodeURIComponent(movie.title)}&year=${encodeURIComponent(movie.year)}`;
  return (
    <div className={`watch-links ${compact ? "watch-links--compact" : ""}`} aria-label={`Where to watch ${movie.title}`}>
      {(listing.amazonId || listing.amazonQuery) && <a href={`/go/amazon${query}`} target="_blank" rel="sponsored noopener">Amazon <span>↗</span></a>}
      {listing.appleUrl && <a href={`/go/apple${query}`} target="_blank" rel="noopener">Apple TV <span>↗</span></a>}
    </div>
  );
}

export default function Home() {
  const [reviews, setReviews] = useState<Movie[]>(fallbackReviews);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [selected, setSelected] = useState<Movie | null>(null);
  const [searching, setSearching] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState("biweekly");
  const [newsletterMessage, setNewsletterMessage] = useState("");
  const [genre, setGenre] = useState("Surprise me");
  const [runtime, setRuntime] = useState("any");
  const [vibe, setVibe] = useState("easy");
  const [recommendations, setRecommendations] = useState<Movie[]>([]);

  useEffect(() => {
    fetch("/api/community")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => setLeaders(data.leaders ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/reviews")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        if (!data.reviews?.length) return;
        const published = data.reviews as Movie[];
        const publishedTitles = new Set(published.map((movie) => movie.title.toLowerCase()));
        setReviews([...published, ...fallbackReviews.filter((movie) => !publishedTitles.has(movie.title.toLowerCase()))]);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (selected && query === selected.title) return;
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/movies/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = await response.json();
        setResults(data.movies ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected]);

  const topFive = useMemo(() => {
    const maxRuntime = runtime === "short" ? 100 : runtime === "medium" ? 125 : runtime === "long" ? 999 : 999;
    const withinRuntime = reviews.filter((movie) => (movie.runtime ?? 0) <= maxRuntime);
    const watchedPool = withinRuntime.length ? withinRuntime : reviews;
    return watchedPool
      .map((movie) => ({
        movie,
        score:
          (matchesVibe(movie, vibe) ? 4 : 0) +
          (matchesGenre(movie, genre) ? 3 : 0) +
          ((movie.rating ?? 0) / 10) +
          (runtime === "any" ? 1 : 0),
      }))
      .sort((a, b) => b.score - a.score || a.movie.title.localeCompare(b.movie.title))
      .slice(0, 5)
      .map(({ movie }) => movie);
  }, [genre, reviews, runtime, vibe]);

  const availableGenres = useMemo(
    () => ["Surprise me", ...genreFilters.filter((item) => reviews.some((movie) => matchesGenre(movie, item)))],
    [reviews],
  );

  async function submitNewsletter(event: FormEvent) {
    event.preventDefault();
    setNewsletterMessage("Joining the reel-mail list…");
    try {
      const response = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "newsletter", email, frequency }),
      });
      if (!response.ok) throw new Error();
      setNewsletterMessage("You’re in. Popcorn not included, regrettably.");
      setEmail("");
    } catch {
      setNewsletterMessage("The projector hiccupped. Please try that again.");
    }
  }

  async function submitRequest(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setRequestMessage("Adding your tiny but mighty vote…");
    try {
      const response = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", movie: selected }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error();
      setLeaders(data.leaders ?? leaders);
      setRequestMessage(`${selected.title} got your vote. Democracy!`);
      setQuery("");
      setSelected(null);
      setResults([]);
    } catch {
      setRequestMessage("That vote missed the ballot box. Give it another go.");
    }
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Will's Reel Deal home">
          <span className="brand__stamp">W</span>
          <span>Will’s Reel Deal<small>opinions, lightly buttered</small></span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#reviews">The takes</a>
          <a href="#picker">Will’s picks</a>
          <a href="#request">Pester Will</a>
          <a href="https://letterboxd.com/foodiefrank/" target="_blank" rel="noopener">Letterboxd ↗</a>
        </nav>
        <a className="button button--small button--cream" href="#newsletter">Get Reel Mail</a>
      </header>

      <section className="hero" id="top">
        <div className="hero__copy">
          <p className="eyebrow"><span /> Freshly watched · dubiously qualified</p>
          <h1>Movie opinions with <em>zero</em> film-school homework.</h1>
          <p className="hero__lede">No secret symbolism. No 20-minute lecture on camera angles. Just plot, acting, vibes, cool stuff, and whether I’d watch it again.</p>
          <div className="hero__actions">
            <a className="button button--lime" href="#reviews">Read the fresh takes <span>↓</span></a>
            <a className="text-link" href="#picker">I need a movie tonight <span>↗</span></a>
          </div>
          <div className="hero__proof">
            <span className="scribble">Not a critic!</span>
            <p><strong>One human opinion.</strong><br />Taste buds may vary.</p>
          </div>
        </div>
        <div className="hero__feature">
          <span className="feature__tag">Will’s latest watch</span>
          <Poster movie={reviews[0]} />
          <div className="feature__score">
            <span>The Will-o-Meter™</span>
            <strong>{formatRating(reviews[0].rating)}<small>/10</small></strong>
          </div>
          <p>“{reviews[0].blurb}”</p>
          <WatchLinks movie={reviews[0]} />
        </div>
        <div className="ticker" aria-hidden="true">
          <span>PLOT ✓</span><span>ACTING ✓</span><span>COOL STUFF ✓</span><span>PRETENSION ✕</span><span>REWATCHABILITY ✓</span>
        </div>
      </section>

      <section className="reviews section" id="reviews">
        <div className="section-heading">
          <div><p className="kicker">01 · Recently judged</p><h2>The fresh takes</h2></div>
          <p>Short reviews. Strong feelings.<br />Absolutely no homework required.</p>
        </div>
        <div className="review-grid">
          {reviews.map((movie, index) => (
            <article className="review-card" key={movie.id}>
              <div className="review-card__poster">
                <Poster movie={movie} />
                <span className="card-number">{String(index + 1).padStart(2, "0")}</span>
              </div>
              <div className="review-card__body">
                <div className="review-card__meta"><span>{movie.genre}</span><span>{movie.runtime} min</span></div>
                <h3>{movie.title}</h3>
                <p>“{movie.blurb}”</p>
                <div className="mini-score"><span>Will-o-Meter</span><strong>{formatRating(movie.rating)}</strong><i style={{ width: `${(movie.rating ?? 0) * 10}%` }} /></div>
                {movie.reviewText && <details className="full-take"><summary>Read Will&apos;s full take</summary><p>{movie.reviewText}</p></details>}
                {movie.letterboxdUrl && <a className="letterboxd-source" href={movie.letterboxdUrl} target="_blank" rel="noopener">See it on Letterboxd <span>↗</span></a>}
                <WatchLinks movie={movie} compact />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="manifesto">
        <p className="kicker">The extremely official methodology</p>
        <div className="manifesto__grid">
          <h2>I rate the stuff you actually argue about on the drive home.</h2>
          <div className="score-list">
            <p><span>01</span><strong>Did the plot plot?</strong><small>Could I follow it - and did I care?</small></p>
            <p><span>02</span><strong>Did the acting act?</strong><small>Did I believe these beautiful strangers?</small></p>
            <p><span>03</span><strong>Was the cool stuff cool?</strong><small>Monsters, car chases, costumes, general razzle-dazzle.</small></p>
            <p><span>04</span><strong>Would I run it back?</strong><small>The couch-test that separates good from great.</small></p>
          </div>
        </div>
        <div className="rating-scale">
          <div className="rating-scale__heading">
            <p className="kicker">The Will-o-Meter decoder ring</p>
            <h3>What every number actually means.</h3>
          </div>
          <ol>
            {[
              ["1", "Abysmal", "Unwatchable and painfully bad in every way. Finishing it feels like punishment."],
              ["2", "Terrible", "Deeply flawed, with almost nothing redeeming except maybe the end credits."],
              ["3", "Awful", "A few glimmers of quality, but mostly incoherent or unpleasant to sit through."],
              ["4", "Poor", "Below average in every respect. Only recommended for the morbidly curious."],
              ["5", "Mediocre", "Functional but forgettable. Passable background noise at best."],
              ["6", "Okay", "Decent enough for a casual watch, but unlikely to leave a lasting impression."],
              ["7", "Good", "Enjoyable and worth watching once, with notable strengths despite some flaws."],
              ["8", "Great", "Strongly recommended, well-made, memorable, and worth revisiting occasionally."],
              ["9", "Excellent", "Nearly flawless. An enthusiastic recommendation and frequent rewatch."],
              ["10", "Masterpiece", "Recommended to everyone and worth watching repeatedly without hesitation."],
            ].map(([score, label, description]) => (
              <li key={score}>
                <strong>{score}<small>/10</small></strong>
                <span>{label}</span>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="picker section" id="picker">
        <div className="picker__intro">
          <p className="kicker">02 · Will’s Watched List</p>
          <h2>Tell Will your vibe.<br /><em>He’ll bring five.</em></h2>
          <p>Every suggestion comes only from movies I have actually watched and reviewed. Three tiny questions. One less hour lost to scrolling.</p>
        </div>
        <div className="picker__panel">
          <fieldset>
            <legend><span>1</span> What sounds good?</legend>
            <div className="chips">
              {availableGenres.map((item) => (
                <button className={genre === item ? "active" : ""} type="button" onClick={() => setGenre(item)} key={item}>{item}</button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend><span>2</span> How much couch time?</legend>
            <div className="segmented">
              {[{ id: "short", label: "Under 100 min" }, { id: "medium", label: "Under 2-ish hrs" }, { id: "any", label: "I live here now" }].map((item) => (
                <button className={runtime === item.id ? "active" : ""} type="button" onClick={() => setRuntime(item.id)} key={item.id}>{item.label}</button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend><span>3</span> Current emotional weather?</legend>
            <div className="mood-row">
              {[{ id: "easy", emoji: "☀", label: "Easy breezy" }, { id: "clever", emoji: "✦", label: "Make me think" }, { id: "chaotic", emoji: "⚡", label: "Pure chaos" }, { id: "cozy", emoji: "☕", label: "Cozy please" }, { id: "intense", emoji: "●", label: "Stress me out" }].map((item) => (
                <button className={vibe === item.id ? "active" : ""} type="button" onClick={() => setVibe(item.id)} key={item.id}><span>{item.emoji}</span>{item.label}</button>
              ))}
            </div>
          </fieldset>
          <button className="button button--lime button--wide" type="button" onClick={() => setRecommendations(topFive)}>Give me Will’s picks <span>→</span></button>
        </div>
        {recommendations.length > 0 && (
          <div className="results-panel" aria-live="polite">
            <div className="results-panel__heading"><p className="kicker">Straight from Will’s watch history</p><h3>Will’s picks for tonight</h3></div>
            <div className="results-list">
              {recommendations.map((movie, index) => (
                <article key={movie.id}>
                  <span className="result-rank">{index + 1}</span>
                  <Poster movie={movie} compact />
                  <div><h4>{movie.title} <small>({movie.year})</small></h4><p>{movie.blurb}</p><span>{movie.genre} · {movie.runtime} min</span></div>
                  <WatchLinks movie={movie} compact />
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="request section" id="request">
        <div className="request__search">
          <p className="kicker">03 · The Popcorn Petition</p>
          <h2>Politely pester Will.</h2>
          <p>Search the living movie catalog, pick the right title, and cast your request. No write-ins, no “that one with the guy.”</p>
          <form onSubmit={submitRequest}>
            <label htmlFor="movie-search">Find a movie</label>
            <div className="movie-search">
              <span>⌕</span>
              <input id="movie-search" value={query} onChange={(event) => {
                const nextQuery = event.target.value;
                setQuery(nextQuery);
                if (selected && nextQuery !== selected.title) setSelected(null);
                if (nextQuery.trim().length < 2) setResults([]);
              }} placeholder="Start typing a movie title…" autoComplete="off" />
              {searching && <i>Searching…</i>}
            </div>
            {results.length > 0 && !selected && (
              <div className="search-results" role="listbox" aria-label="Movie search results">
                {results.map((movie) => (
                  <button type="button" key={movie.id} onClick={() => { setSelected(movie); setQuery(movie.title); setResults([]); }}>
                    <span className="result-dot" /> <strong>{movie.title}</strong> <small>{movie.year || "Year unknown"}</small>
                  </button>
                ))}
              </div>
            )}
            {selected && <div className="selected-movie"><span>Selected</span><strong>{selected.title}</strong><small>{selected.year}</small><button type="button" onClick={() => { setSelected(null); setQuery(""); }}>Change</button></div>}
            <button className="button button--cream button--wide" disabled={!selected} type="submit">Cast my request <span>↑</span></button>
            <p className="form-message" aria-live="polite">{requestMessage}</p>
          </form>
        </div>
        <div className="leaderboard">
          <div className="leaderboard__heading"><span>Live-ish</span><h3>The People’s Pester List</h3><p>Top five most-requested reviews</p></div>
          <ol>
            {leaders.length > 0 ? leaders.map((movie, index) => (
                <li key={movie.id}>
                  <span className="leader-rank">{String(index + 1).padStart(2, "0")}</span>
                  <div><strong>{movie.title}</strong><small>{movie.year}</small></div>
                  <span className="vote-count"><strong>{movie.votes}</strong> requests</span>
                </li>
              )) : (
                <li className="leaderboard__empty">
                  <span className="leader-rank">00</span>
                  <div><strong>Wide open</strong><small>Be the first to pester Will.</small></div>
                </li>
              )}
          </ol>
          <p className="leaderboard__note">Updated whenever someone adds a vote. Yes, your lobbying matters.</p>
        </div>
      </section>

      <section className="newsletter" id="newsletter">
        <div className="newsletter__burst"><span>Reel</span><strong>MAIL!</strong><small>no spam. only ham.*</small></div>
        <div className="newsletter__copy">
          <p className="kicker">Will’s inbox-friendly movie dispatch</p>
          <h2>Good takes. Bad puns.<br />Delivered responsibly.</h2>
          <p>Choose your preferred level of Will in your inbox. Unsubscribe whenever - the theater doors are never locked.</p>
        </div>
        <form onSubmit={submitNewsletter}>
          <div className="frequency-options">
            <label className={frequency === "biweekly" ? "active" : ""}><input type="radio" name="frequency" value="biweekly" checked={frequency === "biweekly"} onChange={(event) => setFrequency(event.target.value)} /><span>Every other week</span><small>The Double Feature Digest</small></label>
            <label className={frequency === "instant" ? "active" : ""}><input type="radio" name="frequency" value="instant" checked={frequency === "instant"} onChange={(event) => setFrequency(event.target.value)} /><span>Every new review</span><small>Fresh Outta the Projector</small></label>
          </div>
          <div className="email-row"><label htmlFor="email">Email address</label><input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@probablywatching.com" /><button className="button button--dark" type="submit">Join Reel Mail →</button></div>
          <p className="form-message" aria-live="polite">{newsletterMessage}</p>
          <p className="newsletter__consent">By joining, you agree to receive Reel Mail at the schedule you selected. Every message includes an unsubscribe link.</p>
        </form>
      </section>

      <footer>
        <a className="brand brand--footer" href="#top"><span className="brand__stamp">W</span><span>Will’s Reel Deal<small>opinions, lightly buttered</small></span></a>
        <p>Made by a movie fan, not a movie critic.<br />© 2026 Will’s Reel Deal</p>
        <div className="footer-links"><a href="#reviews">Reviews</a><a href="#picker">Find a movie</a><a href="#request">Request one</a><a href="https://letterboxd.com/foodiefrank/" target="_blank" rel="noopener">Letterboxd ↗</a><a href="#affiliate-note">Affiliate note</a></div>
        <p className="affiliate-note" id="affiliate-note"><strong>Keeping the lights dim:</strong> As an Amazon Associate, Will earns from qualifying purchases. Apple TV links are provided as a convenience and are not currently affiliate links. Prices and availability can change.</p>
        <span className="footer-wink">ROLL CREDITS →</span>
      </footer>

    </main>
  );
}

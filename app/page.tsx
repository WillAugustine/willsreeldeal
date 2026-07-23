"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { REVIEW_GENRES } from "./genres";
import { fallbackReviews } from "./review-catalog";
import { getWatchListing } from "./watch-catalog";

type Movie = {
  id: string;
  movieId?: string;
  title: string;
  year: string;
  genre?: string;
  runtime?: number;
  vibe?: string;
  color?: string;
  rating?: number;
  blurb?: string;
  reviewText?: string;
  favoriteQuote?: string;
  poster?: string;
  letterboxdUrl?: string;
};

type Leader = Movie & { votes: number };

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
        const fallbackTitles = new Set(fallbackReviews.map((movie) => movie.title.toLowerCase()));
        const fallbackIds = new Set(fallbackReviews.map((movie) => movie.id));
        const publishedByTitle = new Map(published.map((movie) => [movie.title.toLowerCase(), movie]));
        const publishedByCatalogId = new Map(published
          .filter((movie) => movie.movieId && fallbackIds.has(movie.movieId))
          .map((movie) => [movie.movieId, movie]));
        const newReviews = published.filter((movie) => (
          !fallbackTitles.has(movie.title.toLowerCase()) && (!movie.movieId || !fallbackIds.has(movie.movieId))
        ));
        const catalogReviews = fallbackReviews.map((movie) => (
          publishedByCatalogId.get(movie.id) ?? publishedByTitle.get(movie.title.toLowerCase()) ?? movie
        ));
        setReviews([...newReviews, ...catalogReviews]);
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
                {movie.favoriteQuote && <blockquote className="favorite-quote"><span>Favorite line</span><p>{movie.favoriteQuote}</p></blockquote>}
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

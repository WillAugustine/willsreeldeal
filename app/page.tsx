"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

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
};

type Leader = Movie & { votes: number };

const reviews: Movie[] = [
  {
    id: "review-mickey17",
    title: "Mickey 17",
    year: "2025",
    genre: "Sci-fi comedy",
    runtime: 137,
    color: "#d34d36",
    rating: 8.2,
    blurb: "Robert Pattinson dies for a living. Somehow, the paperwork is the scariest part.",
  },
  {
    id: "review-conclave",
    title: "Conclave",
    year: "2024",
    genre: "Drama / mystery",
    runtime: 120,
    color: "#3b55a3",
    rating: 8.8,
    blurb: "Like a group chat with better robes, higher stakes, and Ralph Fiennes.",
  },
  {
    id: "review-companion",
    title: "Companion",
    year: "2025",
    genre: "Thriller",
    runtime: 97,
    color: "#9c4167",
    rating: 7.7,
    blurb: "A terrible couples weekend. Great for everyone who did not attend it.",
  },
];

const moodMovies: Movie[] = [
  { id: "m1", title: "Palm Springs", year: "2020", genre: "Comedy", runtime: 90, vibe: "easy", color: "#ef7f55", blurb: "Sunny, silly, and sneakily sweet." },
  { id: "m2", title: "The Nice Guys", year: "2016", genre: "Comedy", runtime: 116, vibe: "chaotic", color: "#d1a02c", blurb: "Two disasters solve one very fun mystery." },
  { id: "m3", title: "Arrival", year: "2016", genre: "Sci-fi", runtime: 116, vibe: "thoughtful", color: "#527b75", blurb: "Aliens, language, and a respectful amount of feelings." },
  { id: "m4", title: "Mad Max: Fury Road", year: "2015", genre: "Action", runtime: 120, vibe: "chaotic", color: "#c9502f", blurb: "Two hours of shouting ‘that was cool.’" },
  { id: "m5", title: "Knives Out", year: "2019", genre: "Mystery", runtime: 131, vibe: "clever", color: "#765c9c", blurb: "A cozy murder and one spectacular sweater." },
  { id: "m6", title: "The Holdovers", year: "2023", genre: "Drama", runtime: 133, vibe: "cozy", color: "#8b6436", blurb: "Grumpy people slowly become less grumpy." },
  { id: "m7", title: "Game Night", year: "2018", genre: "Comedy", runtime: 100, vibe: "easy", color: "#316f66", blurb: "Competitive friends make several poor choices." },
  { id: "m8", title: "Annihilation", year: "2018", genre: "Sci-fi", runtime: 115, vibe: "weird", color: "#775890", blurb: "Beautiful plants. Terrible bear. No notes." },
  { id: "m9", title: "Dungeons & Dragons: Honor Among Thieves", year: "2023", genre: "Fantasy", runtime: 134, vibe: "easy", color: "#be6a35", blurb: "A charming quest with excellent idiot energy." },
  { id: "m10", title: "Talk to Me", year: "2022", genre: "Horror", runtime: 95, vibe: "intense", color: "#344440", blurb: "Teenagers discover a hand and zero good judgment." },
  { id: "m11", title: "Ocean’s Eleven", year: "2001", genre: "Crime", runtime: 116, vibe: "clever", color: "#5f7143", blurb: "Cool people make crime look alarmingly organized." },
  { id: "m12", title: "The Wild Robot", year: "2024", genre: "Animation", runtime: 102, vibe: "cozy", color: "#418a6c", blurb: "A robot, a goose, and an ambush of emotions." },
];

const fallbackLeaders: Leader[] = [
  { id: "Q13417189", title: "The Wild Robot", year: "2024", votes: 47 },
  { id: "Q111667044", title: "Sinners", year: "2025", votes: 39 },
  { id: "Q104123", title: "The Godfather", year: "1972", votes: 31 },
  { id: "Q189330", title: "Interstellar", year: "2014", votes: 26 },
  { id: "Q63985561", title: "The Substance", year: "2024", votes: 19 },
];

function Poster({ movie, compact = false }: { movie: Movie; compact?: boolean }) {
  return (
    <div className={`poster ${compact ? "poster--compact" : ""}`} style={{ "--poster": movie.color ?? "#3d7654" } as CSSProperties}>
      <div className="poster__grain" />
      <span className="poster__year">{movie.year}</span>
      <span className="poster__mark">WRD</span>
      <strong>{movie.title}</strong>
    </div>
  );
}

function WatchLinks({ movie, compact = false }: { movie: Movie; compact?: boolean }) {
  const query = `?title=${encodeURIComponent(movie.title)}`;
  return (
    <div className={`watch-links ${compact ? "watch-links--compact" : ""}`} aria-label={`Where to watch ${movie.title}`}>
      <a href={`/go/amazon${query}`} target="_blank" rel="sponsored noopener">Amazon <span>↗</span></a>
      <a href={`/go/apple${query}`} target="_blank" rel="sponsored noopener">Apple TV <span>↗</span></a>
      <a href={`/go/netflix${query}`} target="_blank" rel="noopener">Netflix? <span>↗</span></a>
    </div>
  );
}

export default function Home() {
  const [leaders, setLeaders] = useState<Leader[]>(fallbackLeaders);
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
      .then((data) => data.leaders?.length && setLeaders(data.leaders))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (selected && query === selected.title) return;
    setSelected(null);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
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
    const exact = moodMovies.filter((movie) => (genre === "Surprise me" || movie.genre === genre) && (movie.runtime ?? 0) <= maxRuntime);
    const expanded = [...exact, ...moodMovies.filter((movie) => !exact.includes(movie) && (movie.runtime ?? 0) <= maxRuntime)];
    return expanded
      .map((movie) => ({ movie, score: (movie.vibe === vibe ? 3 : 0) + (genre === movie.genre ? 2 : 0) + (runtime === "any" ? 1 : 0) }))
      .sort((a, b) => b.score - a.score || a.movie.title.localeCompare(b.movie.title))
      .slice(0, 5)
      .map(({ movie }) => movie);
  }, [genre, runtime, vibe]);

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
          <a href="#picker">Pick my movie</a>
          <a href="#request">Pester Will</a>
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
          <span className="feature__tag">Will’s pick of the week</span>
          <Poster movie={reviews[0]} />
          <div className="feature__score">
            <span>The Will-o-Meter™</span>
            <strong>{reviews[0].rating}<small>/10</small></strong>
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
              <div className="review-card__poster"><Poster movie={movie} /><span className="card-number">0{index + 1}</span></div>
              <div className="review-card__body">
                <div className="review-card__meta"><span>{movie.genre}</span><span>{movie.runtime} min</span></div>
                <h3>{movie.title}</h3>
                <p>“{movie.blurb}”</p>
                <div className="mini-score"><span>Will-o-Meter</span><strong>{movie.rating}</strong><i style={{ width: `${(movie.rating ?? 0) * 10}%` }} /></div>
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
            <p><span>01</span><strong>Did the plot plot?</strong><small>Could I follow it—and did I care?</small></p>
            <p><span>02</span><strong>Did the acting act?</strong><small>Did I believe these beautiful strangers?</small></p>
            <p><span>03</span><strong>Was the cool stuff cool?</strong><small>Monsters, car chases, costumes, general razzle-dazzle.</small></p>
            <p><span>04</span><strong>Would I run it back?</strong><small>The couch-test that separates good from great.</small></p>
          </div>
        </div>
      </section>

      <section className="picker section" id="picker">
        <div className="picker__intro">
          <p className="kicker">02 · The Mood-to-Movie Machine</p>
          <h2>Tell me your vibe.<br /><em>I’ll bring five.</em></h2>
          <p>Three tiny questions. Five face-value picks. One less hour lost to scrolling.</p>
        </div>
        <div className="picker__panel">
          <fieldset>
            <legend><span>1</span> What sounds good?</legend>
            <div className="chips">
              {["Surprise me", "Comedy", "Action", "Sci-fi", "Mystery", "Drama", "Fantasy", "Horror", "Animation", "Crime"].map((item) => (
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
          <button className="button button--lime button--wide" type="button" onClick={() => setRecommendations(topFive)}>Spin the movie wheel <span>→</span></button>
        </div>
        {recommendations.length > 0 && (
          <div className="results-panel" aria-live="polite">
            <div className="results-panel__heading"><p className="kicker">Your top five</p><h3>Tonight’s couch candidates</h3></div>
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
              <input id="movie-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Start typing a movie title…" autoComplete="off" />
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
            {leaders.map((movie, index) => (
              <li key={movie.id}>
                <span className="leader-rank">{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{movie.title}</strong><small>{movie.year}</small></div>
                <span className="vote-count"><strong>{movie.votes}</strong> requests</span>
              </li>
            ))}
          </ol>
          <p className="leaderboard__note">Updated whenever someone adds a vote. Yes, your lobbying matters.</p>
        </div>
      </section>

      <section className="newsletter" id="newsletter">
        <div className="newsletter__burst"><span>Reel</span><strong>MAIL!</strong><small>no spam. only ham.*</small></div>
        <div className="newsletter__copy">
          <p className="kicker">Will’s inbox-friendly movie dispatch</p>
          <h2>Good takes. Bad puns.<br />Delivered responsibly.</h2>
          <p>Choose your preferred level of Will in your inbox. Unsubscribe whenever—the theater doors are never locked.</p>
        </div>
        <form onSubmit={submitNewsletter}>
          <div className="frequency-options">
            <label className={frequency === "biweekly" ? "active" : ""}><input type="radio" name="frequency" value="biweekly" checked={frequency === "biweekly"} onChange={(event) => setFrequency(event.target.value)} /><span>Every other week</span><small>The Double Feature Digest</small></label>
            <label className={frequency === "instant" ? "active" : ""}><input type="radio" name="frequency" value="instant" checked={frequency === "instant"} onChange={(event) => setFrequency(event.target.value)} /><span>Every new review</span><small>Fresh Outta the Projector</small></label>
          </div>
          <div className="email-row"><label htmlFor="email">Email address</label><input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@probablywatching.com" /><button className="button button--dark" type="submit">Join Reel Mail →</button></div>
          <p className="form-message" aria-live="polite">{newsletterMessage}</p>
        </form>
      </section>

      <footer>
        <a className="brand brand--footer" href="#top"><span className="brand__stamp">W</span><span>Will’s Reel Deal<small>opinions, lightly buttered</small></span></a>
        <p>Made by a movie fan, not a movie critic.<br />© 2026 Will’s Reel Deal</p>
        <div className="footer-links"><a href="#reviews">Reviews</a><a href="#picker">Find a movie</a><a href="#request">Request one</a><a href="#affiliate-note">Affiliate note</a></div>
        <p className="affiliate-note" id="affiliate-note"><strong>Keeping the lights dim:</strong> Amazon and Apple links may become affiliate links once Will is approved for their programs. A qualifying purchase may earn a commission at no added cost to you. Netflix currently offers no public affiliate program, so that button is just neighborly.</p>
        <span className="footer-wink">ROLL CREDITS →</span>
      </footer>
    </main>
  );
}

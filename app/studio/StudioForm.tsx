"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { formatReviewGenres, parseReviewGenres, REVIEW_GENRES } from "../genres";
import {
  formatWatchParties,
  parseWatchParties,
  REWATCH_ODDS,
  SLEEP_RISKS,
  WATCH_PARTIES,
} from "../review-experience";

type Movie = { id: string; title: string; year: string; runtime: number | null; contentRating?: string };
const MAX_POSTER_BYTES = 8 * 1024 * 1024;
const SUPPORTED_POSTER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const POSTER_HELP = "Use a JPG, PNG, or WebP poster smaller than 8 MB.";
type PublishedReview = {
  id: string;
  movieId: string;
  title: string;
  year: string;
  genre: string;
  runtime: number;
  contentRating: string;
  rating: number;
  blurb: string;
  reviewText: string;
  favoriteQuote: string;
  rewatchOdds: string;
  watchParty: string;
  sleepRisk: string;
  amazonUrl: string;
  appleUrl: string;
  poster: string;
  publishedAt: string;
};

export default function StudioForm() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [selected, setSelected] = useState<Movie | null>(null);
  const [searching, setSearching] = useState(false);
  const [posterPreview, setPosterPreview] = useState("");
  const [posterProblem, setPosterProblem] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [runtime, setRuntime] = useState("");
  const [contentRating, setContentRating] = useState("");
  const [movieDetailsMessage, setMovieDetailsMessage] = useState("");
  const [loadingMovieDetails, setLoadingMovieDetails] = useState(false);
  const [rating, setRating] = useState("");
  const [blurb, setBlurb] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [favoriteQuote, setFavoriteQuote] = useState("");
  const [rewatchOdds, setRewatchOdds] = useState("");
  const [watchParties, setWatchParties] = useState<string[]>([]);
  const [sleepRisk, setSleepRisk] = useState("");
  const [amazonUrl, setAmazonUrl] = useState("");
  const [appleUrl, setAppleUrl] = useState("");
  const [message, setMessage] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [reviews, setReviews] = useState<PublishedReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [editingId, setEditingId] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const posterObjectUrl = useRef("");
  const movieDetailsController = useRef<AbortController | null>(null);

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

  useEffect(() => {
    let active = true;
    fetch("/studio/api/reviews")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        if (active) setReviews(data.reviews ?? []);
      })
      .catch(() => {
        if (active) setMessage("The published review archive could not be loaded.");
      })
      .finally(() => {
        if (active) setLoadingReviews(false);
      });
    return () => {
      active = false;
      movieDetailsController.current?.abort();
      if (posterObjectUrl.current) URL.revokeObjectURL(posterObjectUrl.current);
    };
  }, []);

  function posterFileProblem(file: File) {
    if (!SUPPORTED_POSTER_TYPES.has(file.type)) {
      return `${file.name} is not a supported image. ${POSTER_HELP}`;
    }
    if (file.size === 0) return `${file.name} is empty or could not be read. Export a fresh copy and try again.`;
    if (file.size > MAX_POSTER_BYTES) {
      return `${file.name} is ${(file.size / (1024 * 1024)).toFixed(1)} MB. ${POSTER_HELP}`;
    }
    return "";
  }

  function previewPoster(file?: File) {
    if (posterObjectUrl.current) URL.revokeObjectURL(posterObjectUrl.current);
    posterObjectUrl.current = "";
    setPosterProblem("");
    if (!file) {
      setPosterPreview("");
      return true;
    }
    const problem = posterFileProblem(file);
    if (problem) {
      setPosterProblem(problem);
      setPosterPreview("");
      setMessage(problem);
      return false;
    }
    try {
      posterObjectUrl.current = URL.createObjectURL(file);
    } catch {
      const unreadable = `The browser could not open ${file.name}. Export it as a new JPG, PNG, or WebP and try again.`;
      setPosterProblem(unreadable);
      setPosterPreview("");
      setMessage(unreadable);
      return false;
    }
    setPosterPreview(posterObjectUrl.current);
    return true;
  }

  function clearEditor(nextMessage = "") {
    movieDetailsController.current?.abort();
    formRef.current?.reset();
    previewPoster();
    setEditingId("");
    setQuery("");
    setSelected(null);
    setResults([]);
    setSelectedGenres([]);
    setRuntime("");
    setContentRating("");
    setMovieDetailsMessage("");
    setLoadingMovieDetails(false);
    setRating("");
    setBlurb("");
    setReviewText("");
    setFavoriteQuote("");
    setRewatchOdds("");
    setWatchParties([]);
    setSleepRisk("");
    setAmazonUrl("");
    setAppleUrl("");
    setMessage(nextMessage);
  }

  function editReview(review: PublishedReview) {
    formRef.current?.reset();
    if (posterObjectUrl.current) URL.revokeObjectURL(posterObjectUrl.current);
    posterObjectUrl.current = "";
    setEditingId(review.id);
    setSelected({ id: review.movieId, title: review.title, year: review.year, runtime: review.runtime, contentRating: review.contentRating });
    setQuery(review.title);
    setResults([]);
    setSelectedGenres(parseReviewGenres(review.genre));
    setRuntime(String(review.runtime));
    setContentRating(review.contentRating ?? "");
    setMovieDetailsMessage("Runtime and movie rating loaded from the published review.");
    setLoadingMovieDetails(false);
    setRating(review.rating.toFixed(1));
    setBlurb(review.blurb);
    setReviewText(review.reviewText);
    setFavoriteQuote(review.favoriteQuote ?? "");
    setRewatchOdds(review.rewatchOdds ?? "");
    setWatchParties(parseWatchParties(review.watchParty ?? ""));
    setSleepRisk(review.sleepRisk ?? "");
    setAmazonUrl(review.amazonUrl ?? "");
    setAppleUrl(review.appleUrl ?? "");
    setPosterPreview(review.poster);
    setPosterProblem("");
    setMessage(`Editing ${review.title}. The current poster stays unless you choose a new one.`);
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async function chooseMovie(movie: Movie) {
    movieDetailsController.current?.abort();
    const controller = new AbortController();
    movieDetailsController.current = controller;
    setSelected(movie);
    setQuery(movie.title);
    setRuntime(movie.runtime ? String(movie.runtime) : "");
    setContentRating(movie.contentRating ?? "");
    setResults([]);

    if (movie.runtime && movie.contentRating) {
      setMovieDetailsMessage("Runtime and movie rating filled automatically.");
      setLoadingMovieDetails(false);
      return;
    }

    setLoadingMovieDetails(true);
    setMovieDetailsMessage("Checking the movie databases for the missing details...");
    try {
      const exactQuery = `${movie.title}${movie.year ? ` (${movie.year})` : ""}`;
      const response = await fetch(`/api/movies/search?q=${encodeURIComponent(exactQuery)}`, { signal: controller.signal });
      const data = await response.json();
      const exact = (data.movies as Movie[] | undefined)?.find((candidate) => (
        candidate.id === movie.id ||
        (candidate.title.toLowerCase() === movie.title.toLowerCase() && candidate.year === movie.year)
      ));
      if (controller.signal.aborted) return;
      const resolvedRuntime = movie.runtime ?? exact?.runtime ?? null;
      const resolvedRating = movie.contentRating ?? exact?.contentRating ?? "";
      setSelected((current) => current?.id === movie.id ? {
        ...current,
        runtime: resolvedRuntime,
        contentRating: resolvedRating,
      } : current);
      setRuntime(resolvedRuntime ? String(resolvedRuntime) : "");
      setContentRating(resolvedRating);
      setMovieDetailsMessage(
        resolvedRuntime && resolvedRating
          ? "Runtime and movie rating filled automatically."
          : !resolvedRuntime
            ? "Runtime is not listed yet. Enter it below so you can still publish this review."
            : "Movie rating is not listed yet. You can enter it or leave it blank.",
      );
    } catch {
      if (!controller.signal.aborted) {
        setMovieDetailsMessage("Some movie details are not listed yet. Enter any missing runtime below and keep going.");
      }
    } finally {
      if (!controller.signal.aborted) setLoadingMovieDetails(false);
    }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      setMessage("Select the movie from search first.");
      return;
    }
    const posterInput = event.currentTarget.elements.namedItem("poster") as HTMLInputElement | null;
    const poster = posterInput?.files?.[0];
    if (!editingId && !poster) {
      setMessage("Upload one poster image before publishing.");
      return;
    }
    if (poster) {
      const problem = posterFileProblem(poster);
      if (problem) {
        setPosterProblem(problem);
        setMessage(problem);
        return;
      }
    }
    setPublishing(true);
    setMessage("Warming up the projector...");
    const form = new FormData(event.currentTarget);
    form.set("movieId", selected.id);
    form.set("title", selected.title);
    form.set("year", selected.year);
    form.set("genre", formatReviewGenres(selectedGenres));
    form.set("runtime", runtime);
    form.set("contentRating", contentRating);
    form.set("rewatchOdds", rewatchOdds);
    form.set("watchParty", formatWatchParties(watchParties));
    form.set("sleepRisk", sleepRisk);
    if (editingId) form.set("reviewId", editingId);

    try {
      const response = await fetch(new URL("/studio/api/reviews", window.location.origin), {
        method: editingId ? "PUT" : "POST",
        body: form,
      });
      const responseText = await response.text();
      let data: { error?: string; review?: PublishedReview } = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        if (!response.ok) {
          throw new Error(poster
            ? `The poster upload was rejected before it reached the Studio. ${POSTER_HELP}`
            : editingId ? "Saving failed." : "Publishing failed.");
        }
      }
      if (!response.ok) throw new Error(data.error ?? (editingId ? "Saving failed." : "Publishing failed."));
      const savedTitle = selected.title;
      if (data.review) {
        setReviews((current) => (
          editingId
            ? current.map((review) => review.id === editingId ? data.review : review)
            : [data.review, ...current]
        ));
      }
      clearEditor(editingId
        ? `${savedTitle} has been updated everywhere. Nice tune-up.`
        : `${savedTitle} is live. Excellent work, boss.`);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "";
      setMessage(
        poster && /expected pattern/i.test(rawMessage)
          ? `The browser could not upload that poster. ${POSTER_HELP}`
          : rawMessage || "The projector jammed. Try again.",
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="studio-workbench">
      <section className="studio-review-library" aria-labelledby="published-review-heading">
        <div className="studio-review-library__heading">
          <div>
            <span>Previously on Will’s couch</span>
            <h2 id="published-review-heading">Published reviews</h2>
          </div>
          {editingId && <button type="button" onClick={() => clearEditor("Ready for a brand-new take.")}>+ New review</button>}
        </div>
        {loadingReviews ? (
          <p className="studio-review-library__empty">Opening the review archive...</p>
        ) : reviews.length ? (
          <div className="studio-review-list">
            {reviews.map((review) => (
              <article className={editingId === review.id ? "is-editing" : ""} key={review.id}>
                <img src={review.poster} alt="" referrerPolicy="no-referrer" />
                <div>
                  <strong>{review.title}</strong>
                  <span>{review.year} · {review.rating.toFixed(1)}/10</span>
                </div>
                <button type="button" onClick={() => editReview(review)} aria-label={`Edit ${review.title}`}>
                  {editingId === review.id ? "Editing" : "Edit review"}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="studio-review-library__empty">Reviews published from this studio will appear here, ready for future tune-ups.</p>
        )}
      </section>

      <form className={`studio-form ${editingId ? "studio-form--editing" : ""}`} onSubmit={publish} ref={formRef} noValidate>
        <div className="studio-form__heading">
          <span>{editingId ? "Edit published review" : "New review"}</span>
          <strong>{editingId ? "EDIT" : "01"}</strong>
        </div>

        <div className="studio-field studio-movie-field">
          <label htmlFor="studio-movie">Which movie survived Will’s couch?</label>
          <div className="studio-search">
            <span>⌕</span>
            <input id="studio-movie" value={query} onChange={(event) => {
              const nextQuery = event.target.value;
              movieDetailsController.current?.abort();
              setQuery(nextQuery);
              if (selected && nextQuery !== selected.title) {
                setSelected(null);
                setRuntime("");
                setContentRating("");
                setMovieDetailsMessage("");
                setLoadingMovieDetails(false);
              }
              if (nextQuery.trim().length < 2) setResults([]);
            }} placeholder="Search the movie universe" autoComplete="off" required />
            <i>{searching ? "Searching..." : selected ? "Selected" : "Pick from list"}</i>
          </div>
          {results.length > 0 && !selected && (
            <div className="studio-search-results">
              {results.map((movie) => (
                <button key={movie.id} type="button" onClick={() => void chooseMovie(movie)}>
                  <span className="result-dot" />
                  <strong>{movie.title}</strong>
                  <small>{movie.year || "Year unknown"}{movie.runtime ? ` · ${movie.runtime} min` : ""}{movie.contentRating ? ` · ${movie.contentRating}` : ""}</small>
                </button>
              ))}
            </div>
          )}
          {selected && <p className="studio-selected">Locked in: <strong>{selected.title}</strong> ({selected.year}) <button type="button" onClick={() => {
            movieDetailsController.current?.abort();
            setSelected(null);
            setQuery("");
            setRuntime("");
            setContentRating("");
            setMovieDetailsMessage("");
            setLoadingMovieDetails(false);
          }}>Change</button></p>}
          {selected && <p className="studio-movie-details" aria-live="polite">{loadingMovieDetails ? "Looking up runtime and movie rating..." : movieDetailsMessage}</p>}
        </div>

        <fieldset className="studio-field studio-genre-field">
          <legend>Genres</legend>
          <p>Pick every genre that fits. The site keeps spelling and formatting consistent.</p>
          <div className="studio-genre-grid">
            {REVIEW_GENRES.map((genre) => {
              const checked = selectedGenres.includes(genre);
              return (
                <label className={checked ? "selected" : ""} key={genre}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setSelectedGenres((current) => (
                      current.includes(genre)
                        ? current.filter((item) => item !== genre)
                        : [...current, genre]
                    ))}
                  />
                  <span>{genre}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="studio-form__row studio-form__row--numbers">
          <div className="studio-field studio-field--small">
            <label htmlFor="runtime">Runtime <span>Auto-filled when listed</span></label>
            <div className="input-suffix"><input id="runtime" name="runtime" type="number" min="1" max="600" value={runtime} onChange={(event) => setRuntime(event.target.value)} placeholder="Select a movie" required /><span>MIN</span></div>
          </div>
          <div className="studio-field studio-field--small">
            <label htmlFor="contentRating">Movie rating <span>Auto-filled when listed</span></label>
            <input id="contentRating" name="contentRating" type="text" maxLength={12} value={contentRating} onChange={(event) => setContentRating(event.target.value.toUpperCase())} placeholder="PG-13" />
          </div>
          <div className="studio-field studio-field--small">
            <label htmlFor="rating">Will-o-Meter</label>
            <div className="input-suffix"><input id="rating" name="rating" type="number" min="0" max="10" step="0.1" value={rating} onChange={(event) => setRating(event.target.value)} placeholder="8.2" required /><span>/10</span></div>
          </div>
        </div>

        <div className="studio-field">
          <label htmlFor="blurb">The snack-size take</label>
          <input id="blurb" name="blurb" value={blurb} onChange={(event) => setBlurb(event.target.value)} minLength={10} maxLength={220} placeholder="One quotable sentence for the review card" required />
        </div>

        <div className="studio-field">
          <label htmlFor="reviewText">The full couch report</label>
          <textarea id="reviewText" name="reviewText" value={reviewText} onChange={(event) => setReviewText(event.target.value)} minLength={editingId ? 1 : 40} rows={8} placeholder="Plot, acting, how cool it looked, what dragged, and whether you would watch it again..." required />
        </div>

        <div className="studio-field">
          <label htmlFor="favoriteQuote">Favorite movie quote <span>Optional</span></label>
          <textarea
            className="studio-quote-input"
            id="favoriteQuote"
            name="favoriteQuote"
            value={favoriteQuote}
            onChange={(event) => setFavoriteQuote(event.target.value)}
            maxLength={300}
            rows={3}
            placeholder="The line you immediately wanted to repeat"
          />
        </div>

        <div className="studio-experience-panel">
          <div className="studio-experience-panel__heading">
            <span>Couch experience</span>
            <p>Optional details that tell readers what watching it actually felt like.</p>
          </div>

          <fieldset className="studio-experience-field">
            <legend>Rewatch Odds <span>Optional</span></legend>
            <div className="studio-choice-grid">
              {REWATCH_ODDS.map((option) => (
                <button
                  className={rewatchOdds === option ? "selected" : ""}
                  type="button"
                  aria-pressed={rewatchOdds === option}
                  key={option}
                  onClick={() => setRewatchOdds((current) => current === option ? "" : option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="studio-experience-field">
            <legend>Ideal Watch Party <span>Pick any that fit</span></legend>
            <div className="studio-choice-grid">
              {WATCH_PARTIES.map((option) => {
                const selectedOption = watchParties.includes(option);
                return (
                  <button
                    className={selectedOption ? "selected" : ""}
                    type="button"
                    aria-pressed={selectedOption}
                    key={option}
                    onClick={() => setWatchParties((current) => (
                      current.includes(option)
                        ? current.filter((item) => item !== option)
                        : [...current, option]
                    ))}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="studio-experience-field">
            <legend>Sleep Risk <span>Optional</span></legend>
            <div className="studio-choice-grid studio-choice-grid--three">
              {SLEEP_RISKS.map((option) => (
                <button
                  className={sleepRisk === option ? "selected" : ""}
                  type="button"
                  aria-pressed={sleepRisk === option}
                  key={option}
                  onClick={() => setSleepRisk((current) => current === option ? "" : option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="studio-experience-panel">
          <div className="studio-experience-panel__heading">
            <span>Rent or buy links</span>
            <p>Optional. Theater-only movie? Leave both fields blank. A provider button appears only when you paste an exact rent or buy page.</p>
          </div>

          <div className="studio-field">
            <label htmlFor="amazonUrl">Amazon movie URL <span>Affiliate tag added automatically</span></label>
            <input
              id="amazonUrl"
              name="amazonUrl"
              type="url"
              value={amazonUrl}
              onChange={(event) => setAmazonUrl(event.target.value)}
              placeholder="https://www.amazon.com/gp/video/detail/..."
            />
          </div>

          <div className="studio-field">
            <label htmlFor="appleUrl">Apple TV movie URL <span>Optional</span></label>
            <input
              id="appleUrl"
              name="appleUrl"
              type="url"
              value={appleUrl}
              onChange={(event) => setAppleUrl(event.target.value)}
              placeholder="https://tv.apple.com/us/movie/..."
            />
          </div>
        </div>

        <div className="studio-field">
          <label htmlFor="poster">Poster art {editingId && <span>Optional when editing</span>}</label>
          <label className={`poster-drop ${posterPreview ? "poster-drop--has-image" : ""}`} htmlFor="poster">
            {posterPreview ? (
              <img
                src={posterPreview}
                alt="Poster preview"
                onError={() => {
                  if (!posterObjectUrl.current) return;
                  const unreadable = "The browser could not read that poster. Export it as a new JPG, PNG, or WebP and try again.";
                  setPosterProblem(unreadable);
                  setMessage(unreadable);
                }}
              />
            ) : <><strong>Drop in the poster</strong><span>JPG, PNG, or WebP under 8 MB</span><i>Choose image</i></>}
          </label>
          <input
            className="poster-input"
            id="poster"
            name="poster"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={(event) => {
              if (!previewPoster(event.target.files?.[0])) event.currentTarget.value = "";
            }}
            required={!editingId}
          />
          {posterProblem && <p className="studio-field-note studio-field-note--error" role="alert">{posterProblem}</p>}
        </div>

        <div className="studio-submit">
          <p aria-live="polite">{message || "Publishing makes the review visible on the homepage immediately."}</p>
          {editingId && <button className="studio-cancel-edit" type="button" onClick={() => clearEditor("No changes made.")}>Cancel</button>}
          <button className="button button--lime" type="submit" disabled={publishing || !selected || selectedGenres.length === 0 || !runtime || Boolean(posterProblem)}>
            {publishing ? "Saving..." : editingId ? "Save the tune-up" : "Publish the take"}<span>↗</span>
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { formatReviewGenres, REVIEW_GENRES } from "../genres";

type Movie = { id: string; title: string; year: string };

export default function StudioForm() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [selected, setSelected] = useState<Movie | null>(null);
  const [searching, setSearching] = useState(false);
  const [posterPreview, setPosterPreview] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [publishing, setPublishing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

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

  function previewPoster(file?: File) {
    if (posterPreview) URL.revokeObjectURL(posterPreview);
    setPosterPreview(file ? URL.createObjectURL(file) : "");
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      setMessage("Select the movie from search first.");
      return;
    }
    setPublishing(true);
    setMessage("Warming up the projector...");
    const form = new FormData(event.currentTarget);
    form.set("movieId", selected.id);
    form.set("title", selected.title);
    form.set("year", selected.year);
    form.set("genre", formatReviewGenres(selectedGenres));

    try {
      const response = await fetch("/studio/api/reviews", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Publishing failed.");
      setMessage(`${selected.title} is live. Excellent work, boss.`);
      formRef.current?.reset();
      setQuery("");
      setSelected(null);
      setResults([]);
      setSelectedGenres([]);
      previewPoster();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The projector jammed. Try again.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <form className="studio-form" onSubmit={publish} ref={formRef}>
      <div className="studio-form__heading">
        <span>New review</span>
        <strong>01</strong>
      </div>

      <div className="studio-field studio-movie-field">
        <label htmlFor="studio-movie">Which movie survived Will’s couch?</label>
        <div className="studio-search">
          <span>⌕</span>
          <input id="studio-movie" value={query} onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            if (selected && nextQuery !== selected.title) setSelected(null);
            if (nextQuery.trim().length < 2) setResults([]);
          }} placeholder="Search the movie universe" autoComplete="off" required />
          <i>{searching ? "Searching..." : selected ? "Selected" : "Pick from list"}</i>
        </div>
        {results.length > 0 && !selected && (
          <div className="studio-search-results">
            {results.map((movie) => (
              <button key={movie.id} type="button" onClick={() => { setSelected(movie); setQuery(movie.title); setResults([]); }}>
                <span className="result-dot" />
                <strong>{movie.title}</strong>
                <small>{movie.year || "Year unknown"}</small>
              </button>
            ))}
          </div>
        )}
        {selected && <p className="studio-selected">Locked in: <strong>{selected.title}</strong> ({selected.year}) <button type="button" onClick={() => { setSelected(null); setQuery(""); }}>Change</button></p>}
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
          <label htmlFor="runtime">Runtime</label>
          <div className="input-suffix"><input id="runtime" name="runtime" type="number" min="1" max="600" placeholder="120" required /><span>MIN</span></div>
        </div>
        <div className="studio-field studio-field--small">
          <label htmlFor="rating">Will-o-Meter</label>
          <div className="input-suffix"><input id="rating" name="rating" type="number" min="0" max="10" step="0.1" placeholder="8.2" required /><span>/10</span></div>
        </div>
      </div>

      <div className="studio-field">
        <label htmlFor="blurb">The snack-size take</label>
        <input id="blurb" name="blurb" minLength={10} maxLength={220} placeholder="One quotable sentence for the review card" required />
      </div>

      <div className="studio-field">
        <label htmlFor="reviewText">The full couch report</label>
        <textarea id="reviewText" name="reviewText" minLength={40} rows={8} placeholder="Plot, acting, how cool it looked, what dragged, and whether you would watch it again..." required />
      </div>

      <div className="studio-field">
        <label htmlFor="poster">Poster art</label>
        <label className={`poster-drop ${posterPreview ? "poster-drop--has-image" : ""}`} htmlFor="poster">
          {posterPreview ? <img src={posterPreview} alt="Poster preview" /> : <><strong>Drop in the poster</strong><span>Portrait art works best</span><i>Choose image</i></>}
        </label>
        <input className="poster-input" id="poster" name="poster" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => previewPoster(event.target.files?.[0])} required />
      </div>

      <div className="studio-submit">
        <p aria-live="polite">{message || "Publishing makes the review visible on the homepage immediately."}</p>
        <button className="button button--lime" type="submit" disabled={publishing || !selected || selectedGenres.length === 0}>{publishing ? "Publishing..." : "Publish the take"}<span>↗</span></button>
      </div>
    </form>
  );
}

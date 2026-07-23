export const REVIEW_GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
] as const;

export function formatReviewGenres(genres: string[]) {
  return genres.join(" / ");
}

export function parseReviewGenres(value: string) {
  const allowed = new Set<string>(REVIEW_GENRES);
  return value
    .split("/")
    .map((genre) => genre.trim())
    .filter((genre, index, genres) => allowed.has(genre) && genres.indexOf(genre) === index);
}

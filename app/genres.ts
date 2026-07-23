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
  const allowed = new Map(REVIEW_GENRES.map((genre) => [genre.toLowerCase(), genre]));
  return value
    .split("/")
    .map((genre) => genre.trim())
    .map((genre) => allowed.get(genre.toLowerCase()))
    .filter((genre): genre is typeof REVIEW_GENRES[number] => Boolean(genre))
    .filter((genre, index, genres) => genres.indexOf(genre) === index);
}

export const REWATCH_ODDS = [
  "Never again",
  "Probably not",
  "Maybe someday",
  "Absolutely",
  "Annual tradition",
] as const;

export const WATCH_PARTIES = [
  "Solo",
  "Date night",
  "Friends",
  "Family",
  "Full theater",
] as const;

export const SLEEP_RISKS = [
  "Wide awake",
  "Eyelids got heavy",
  "Lost the battle",
] as const;

export function canonicalChoice(value: string, choices: readonly string[]) {
  return choices.find((choice) => choice.toLowerCase() === value.trim().toLowerCase()) ?? "";
}

export function parseWatchParties(value: string) {
  return value
    .split("/")
    .map((choice) => canonicalChoice(choice, WATCH_PARTIES))
    .filter((choice, index, choices) => Boolean(choice) && choices.indexOf(choice) === index);
}

export function formatWatchParties(choices: string[]) {
  return choices.join(" / ");
}

export const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-read-email",
] as const

export function spotifyScopesString() {
  return SPOTIFY_SCOPES.join(" ")
}


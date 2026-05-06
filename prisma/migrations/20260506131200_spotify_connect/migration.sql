PRAGMA foreign_keys=OFF;

-- Add columns to UserSession (device selection)
ALTER TABLE "UserSession" ADD COLUMN "spotifyDeviceId" TEXT;

-- Add columns to NowPlaying (which session controls playback)
ALTER TABLE "NowPlaying" ADD COLUMN "playbackSessionId" TEXT;

-- CreateTable: SpotifyAuth
CREATE TABLE "SpotifyAuth" (
  "sessionId" TEXT NOT NULL PRIMARY KEY,
  "accessToken" TEXT NOT NULL,
  "refreshToken" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "spotifyUserId" TEXT,
  "email" TEXT,
  "displayName" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SpotifyAuth_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "UserSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX "SpotifyAuth_spotifyUserId_idx" ON "SpotifyAuth"("spotifyUserId");
CREATE INDEX "SpotifyAuth_email_idx" ON "SpotifyAuth"("email");
CREATE INDEX "NowPlaying_playbackSessionId_idx" ON "NowPlaying"("playbackSessionId");

PRAGMA foreign_keys=ON;


-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'guest',
    "ip" TEXT,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QueueItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "youtubeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "thumbnailUrl" TEXT,
    "durationSec" INTEGER,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "position" INTEGER NOT NULL,
    "addedBySessionId" TEXT,
    CONSTRAINT "QueueItem_addedBySessionId_fkey" FOREIGN KEY ("addedBySessionId") REFERENCES "UserSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NowPlaying" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "queueItemId" TEXT,
    "youtubeId" TEXT,
    "startedAt" DATETIME,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NowPlaying_queueItemId_fkey" FOREIGN KEY ("queueItemId") REFERENCES "QueueItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SongMetadata" (
    "youtubeId" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "durationSec" INTEGER,
    "thumbnailUrl" TEXT,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlayHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "youtubeId" TEXT NOT NULL,
    "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playedCountDelta" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "PlayHistory_youtubeId_fkey" FOREIGN KEY ("youtubeId") REFERENCES "SongMetadata" ("youtubeId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminGrant" (
    "sessionId" TEXT NOT NULL PRIMARY KEY,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "AdminGrant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "UserSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ban" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ip" TEXT,
    "sessionId" TEXT,
    "bannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT
);

-- CreateIndex
CREATE INDEX "UserSession_ip_idx" ON "UserSession"("ip");

-- CreateIndex
CREATE INDEX "UserSession_lastSeenAt_idx" ON "UserSession"("lastSeenAt");

-- CreateIndex
CREATE INDEX "QueueItem_position_idx" ON "QueueItem"("position");

-- CreateIndex
CREATE INDEX "QueueItem_youtubeId_idx" ON "QueueItem"("youtubeId");

-- CreateIndex
CREATE INDEX "QueueItem_addedAt_idx" ON "QueueItem"("addedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NowPlaying_queueItemId_key" ON "NowPlaying"("queueItemId");

-- CreateIndex
CREATE INDEX "NowPlaying_queueItemId_idx" ON "NowPlaying"("queueItemId");

-- CreateIndex
CREATE INDEX "SongMetadata_playCount_idx" ON "SongMetadata"("playCount");

-- CreateIndex
CREATE INDEX "SongMetadata_lastPlayedAt_idx" ON "SongMetadata"("lastPlayedAt");

-- CreateIndex
CREATE INDEX "PlayHistory_playedAt_idx" ON "PlayHistory"("playedAt");

-- CreateIndex
CREATE INDEX "PlayHistory_youtubeId_playedAt_idx" ON "PlayHistory"("youtubeId", "playedAt");

-- CreateIndex
CREATE INDEX "Ban_ip_idx" ON "Ban"("ip");

-- CreateIndex
CREATE INDEX "Ban_sessionId_idx" ON "Ban"("sessionId");

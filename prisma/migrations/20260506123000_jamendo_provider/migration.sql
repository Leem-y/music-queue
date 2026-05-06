PRAGMA foreign_keys=OFF;

-- RedefineTable: QueueItem
CREATE TABLE "new_QueueItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "thumbnailUrl" TEXT,
    "durationSec" INTEGER,
    "audioUrl" TEXT,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "position" INTEGER NOT NULL,
    "addedBySessionId" TEXT,
    CONSTRAINT "QueueItem_addedBySessionId_fkey" FOREIGN KEY ("addedBySessionId") REFERENCES "UserSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_QueueItem" ("id","provider","trackId","title","artist","thumbnailUrl","durationSec","audioUrl","addedAt","position","addedBySessionId")
SELECT "id",'youtube',"youtubeId","title","artist","thumbnailUrl","durationSec",NULL,"addedAt","position","addedBySessionId" FROM "QueueItem";
DROP TABLE "QueueItem";
ALTER TABLE "new_QueueItem" RENAME TO "QueueItem";

-- RedefineTable: NowPlaying
CREATE TABLE "new_NowPlaying" (
    "id" INTEGER NOT NULL PRIMARY KEY,
    "queueItemId" TEXT,
    "provider" TEXT,
    "trackId" TEXT,
    "startedAt" DATETIME,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NowPlaying_queueItemId_fkey" FOREIGN KEY ("queueItemId") REFERENCES "QueueItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_NowPlaying" ("id","queueItemId","provider","trackId","startedAt","isPaused","updatedAt")
SELECT "id","queueItemId",
       CASE WHEN "youtubeId" IS NULL THEN NULL ELSE 'youtube' END,
       "youtubeId",
       "startedAt","isPaused","updatedAt"
FROM "NowPlaying";
DROP TABLE "NowPlaying";
ALTER TABLE "new_NowPlaying" RENAME TO "NowPlaying";

-- RedefineTable: SongMetadata (change PK to provider+trackId)
CREATE TABLE "new_SongMetadata" (
    "provider" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "durationSec" INTEGER,
    "thumbnailUrl" TEXT,
    "audioUrl" TEXT,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    PRIMARY KEY ("provider","trackId")
);
INSERT INTO "new_SongMetadata" ("provider","trackId","title","artist","durationSec","thumbnailUrl","audioUrl","playCount","lastPlayedAt","createdAt","updatedAt")
SELECT 'youtube',"youtubeId","title","artist","durationSec","thumbnailUrl",NULL,"playCount","lastPlayedAt","createdAt","updatedAt"
FROM "SongMetadata";
DROP TABLE "SongMetadata";
ALTER TABLE "new_SongMetadata" RENAME TO "SongMetadata";

-- RedefineTable: PlayHistory
CREATE TABLE "new_PlayHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playedCountDelta" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "PlayHistory_provider_trackId_fkey" FOREIGN KEY ("provider","trackId") REFERENCES "SongMetadata" ("provider","trackId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlayHistory" ("id","provider","trackId","playedAt","playedCountDelta")
SELECT "id",'youtube',"youtubeId","playedAt","playedCountDelta" FROM "PlayHistory";
DROP TABLE "PlayHistory";
ALTER TABLE "new_PlayHistory" RENAME TO "PlayHistory";

-- Recreate indexes
CREATE INDEX "QueueItem_position_idx" ON "QueueItem"("position");
CREATE INDEX "QueueItem_provider_trackId_idx" ON "QueueItem"("provider","trackId");
CREATE INDEX "QueueItem_addedAt_idx" ON "QueueItem"("addedAt");
CREATE UNIQUE INDEX "NowPlaying_queueItemId_key" ON "NowPlaying"("queueItemId");
CREATE INDEX "NowPlaying_queueItemId_idx" ON "NowPlaying"("queueItemId");
CREATE INDEX "SongMetadata_playCount_idx" ON "SongMetadata"("playCount");
CREATE INDEX "SongMetadata_lastPlayedAt_idx" ON "SongMetadata"("lastPlayedAt");
CREATE INDEX "PlayHistory_playedAt_idx" ON "PlayHistory"("playedAt");
CREATE INDEX "PlayHistory_provider_trackId_playedAt_idx" ON "PlayHistory"("provider","trackId","playedAt");

PRAGMA foreign_keys=ON;


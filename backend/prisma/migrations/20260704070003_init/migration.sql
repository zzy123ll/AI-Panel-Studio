-- CreateTable
CREATE TABLE "Discussion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "config" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discussion_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stance" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    CONSTRAINT "Participant_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "Discussion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TranscriptEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discussion_id" TEXT NOT NULL,
    "speaker_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TranscriptEntry_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "Discussion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TranscriptEntry_speaker_id_fkey" FOREIGN KEY ("speaker_id") REFERENCES "Participant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConsensusItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discussion_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "generated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsensusItem_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "Discussion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DivergenceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discussion_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "involved_participants" TEXT NOT NULL DEFAULT '[]',
    "generated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DivergenceItem_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "Discussion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Participant_discussion_id_idx" ON "Participant"("discussion_id");

-- CreateIndex
CREATE INDEX "TranscriptEntry_discussion_id_idx" ON "TranscriptEntry"("discussion_id");

-- CreateIndex
CREATE INDEX "TranscriptEntry_speaker_id_idx" ON "TranscriptEntry"("speaker_id");

-- CreateIndex
CREATE INDEX "ConsensusItem_discussion_id_idx" ON "ConsensusItem"("discussion_id");

-- CreateIndex
CREATE INDEX "DivergenceItem_discussion_id_idx" ON "DivergenceItem"("discussion_id");

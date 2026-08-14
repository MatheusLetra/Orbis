ALTER TABLE "releases" RENAME COLUMN "storage_key" TO "artifact_location";--> statement-breakpoint
ALTER TABLE "releases" DROP COLUMN "checksum";--> statement-breakpoint
ALTER TABLE "releases" DROP COLUMN "size_bytes";--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_published_location_check" CHECK ("status" <> 'PUBLISHED' OR ("artifact_location" IS NOT NULL AND btrim("artifact_location") <> '' AND char_length("artifact_location") <= 2048));

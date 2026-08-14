DROP INDEX "notifications_company_user_idx";--> statement-breakpoint
DELETE FROM "notification_preferences" WHERE "company_id" IS NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "company_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "event_id" uuid;--> statement-breakpoint
CREATE INDEX "notifications_company_user_created_id_idx" ON "notifications" USING btree ("company_id","user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "notifications_company_user_unread_idx" ON "notifications" USING btree ("company_id","user_id") WHERE "notifications"."read_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_company_user_event_unique" ON "notifications" USING btree ("company_id","user_id","event_id") WHERE "notifications"."event_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" DROP COLUMN "email_enabled";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "conversations" c
    LEFT JOIN "conversation_members" cm ON cm."conversation_id" = c."id"
    GROUP BY c."id", c."type"
    HAVING c."type" <> 'direct'
      OR count(cm."user_id") <> 2
      OR count(DISTINCT cm."user_id") <> 2
  ) THEN
    RAISE EXCEPTION 'M17 chat migration cannot backfill direct_key: every conversation must be direct with exactly two distinct members';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "direct_key" text;--> statement-breakpoint
UPDATE "conversations" c
SET "direct_key" = pairs."direct_key"
FROM (
  SELECT "conversation_id", string_agg("user_id"::text, ':' ORDER BY "user_id"::text) AS "direct_key"
  FROM "conversation_members"
  GROUP BY "conversation_id"
) pairs
WHERE pairs."conversation_id" = c."id";--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "conversations" WHERE "direct_key" IS NULL) THEN
    RAISE EXCEPTION 'M17 chat migration failed to backfill direct_key';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "conversations"
    GROUP BY "company_id", "direct_key"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'M17 chat migration cannot enforce unique direct pairs: duplicate company/direct_key found';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "direct_key" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "conversation_members_user_conversation_idx" ON "conversation_members" USING btree ("user_id","conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_company_direct_key_unique" ON "conversations" USING btree ("company_id","direct_key");--> statement-breakpoint
DROP INDEX "messages_conversation_created_idx";--> statement-breakpoint
CREATE INDEX "messages_conversation_created_id_idx" ON "messages" USING btree ("conversation_id","created_at","id");--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_type_direct_check" CHECK ("conversations"."type" = 'direct');

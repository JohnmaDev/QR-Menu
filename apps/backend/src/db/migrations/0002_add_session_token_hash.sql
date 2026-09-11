ALTER TABLE "sessions" RENAME COLUMN "id" TO "token_hash";--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "token_hash" SET DATA TYPE varchar(64);

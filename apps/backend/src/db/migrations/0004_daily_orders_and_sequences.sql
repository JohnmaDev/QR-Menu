CREATE TABLE IF NOT EXISTS "daily_order_sequences" (
	"order_date" date PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_date" date DEFAULT CURRENT_DATE NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "daily_order_number" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_public_code_unique";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_orders_date_code" ON "orders" ("order_date", "public_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_orders_date" ON "orders" ("order_date");

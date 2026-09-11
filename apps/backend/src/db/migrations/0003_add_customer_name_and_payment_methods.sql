ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_name" varchar(50);--> statement-breakpoint
ALTER TYPE "public"."payment_method_declared" ADD VALUE IF NOT EXISTS 'BRE_B';--> statement-breakpoint
ALTER TYPE "public"."payment_method_declared" ADD VALUE IF NOT EXISTS 'BANCOLOMBIA';

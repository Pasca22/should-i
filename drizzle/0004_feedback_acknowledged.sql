ALTER TABLE "feedback" ADD COLUMN "acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "acknowledged_by" text;
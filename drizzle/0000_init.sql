CREATE TABLE "checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sport" text NOT NULL,
	"route" jsonb NOT NULL,
	"date" date NOT NULL,
	"start_time" text,
	"duration_min" integer,
	"state" jsonb NOT NULL,
	"questions" jsonb NOT NULL,
	"answers" jsonb NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weather_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"response" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "checks_created_idx" ON "checks" USING btree ("created_at");
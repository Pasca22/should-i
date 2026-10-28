CREATE TABLE "beta_invites" (
	"email" text PRIMARY KEY NOT NULL,
	"note" text,
	"invited_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "checks" ADD CONSTRAINT "checks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checks_user_created_idx" ON "checks" USING btree ("user_id","created_at");
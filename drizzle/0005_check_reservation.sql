ALTER TABLE "checks" ALTER COLUMN "route" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "checks" ALTER COLUMN "date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "checks" ALTER COLUMN "state" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "checks" ALTER COLUMN "questions" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "checks" ALTER COLUMN "answers" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "checks" ALTER COLUMN "model" DROP NOT NULL;
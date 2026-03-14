CREATE TABLE "banned_ips" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip" varchar(45) NOT NULL,
	"reason" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "banned_ips_ip_unique" UNIQUE("ip")
);
--> statement-breakpoint
CREATE TABLE "domain_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain_id" integer NOT NULL,
	"date" date NOT NULL,
	"visitors" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "domain_static" ALTER COLUMN "domain_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "domain_static" ALTER COLUMN "total_requests" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "domain" ALTER COLUMN "user_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "name" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "domain" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "github_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "avatar_url" varchar(255);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "domain_visits" ADD CONSTRAINT "domain_visits_domain_id_domain_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domain"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_github_id_unique" UNIQUE("github_id");
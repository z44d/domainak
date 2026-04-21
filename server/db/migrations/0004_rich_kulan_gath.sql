CREATE TABLE "banned_domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" varchar(255) NOT NULL,
	"reason" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "banned_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
ALTER TABLE "domain" ALTER COLUMN "hostname" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "domain" ALTER COLUMN "port" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "domain" ADD COLUMN "target_url" varchar(500);--> statement-breakpoint
CREATE INDEX "banned_domains_created_at_idx" ON "banned_domains" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "banned_ips_created_at_idx" ON "banned_ips" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "domain_user_id_idx" ON "domain" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "domain_created_at_idx" ON "domain" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_is_banned_idx" ON "user" USING btree ("is_banned");
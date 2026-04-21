CREATE TABLE "banned_domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" varchar(255) NOT NULL,
	"reason" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "banned_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "banned_ips" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip" varchar(45) NOT NULL,
	"reason" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "banned_ips_ip_unique" UNIQUE("ip")
);
--> statement-breakpoint
CREATE TABLE "domain_static" (
	"domain_id" integer NOT NULL,
	"total_requests" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subdomain" varchar(64) NOT NULL,
	"hostname" varchar(64),
	"port" integer,
	"target_url" varchar(500),
	"mode" varchar(8) DEFAULT 'proxy' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "domain_subdomain_unique" UNIQUE("subdomain")
);
--> statement-breakpoint
CREATE TABLE "domain_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain_id" integer NOT NULL,
	"date" date NOT NULL,
	"visitors" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" serial PRIMARY KEY NOT NULL,
	"github_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_github_id_unique" UNIQUE("github_id"),
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "domain_static" ADD CONSTRAINT "domain_static_domain_id_domain_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domain"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain" ADD CONSTRAINT "domain_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_visits" ADD CONSTRAINT "domain_visits_domain_id_domain_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domain"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "banned_domains_created_at_idx" ON "banned_domains" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "banned_ips_created_at_idx" ON "banned_ips" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "domain_user_id_idx" ON "domain" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "domain_created_at_idx" ON "domain" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_is_banned_idx" ON "user" USING btree ("is_banned");
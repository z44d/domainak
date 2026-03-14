CREATE TABLE "domain_static" (
	"domain_id" serial NOT NULL,
	"total_requests" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" serial NOT NULL,
	"subdomain" varchar(64) NOT NULL,
	"hostname" varchar(64) NOT NULL,
	"port" integer NOT NULL,
	CONSTRAINT "domain_subdomain_unique" UNIQUE("subdomain")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(32) NOT NULL,
	"email" varchar NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "domain_static" ADD CONSTRAINT "domain_static_domain_id_domain_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domain"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain" ADD CONSTRAINT "domain_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
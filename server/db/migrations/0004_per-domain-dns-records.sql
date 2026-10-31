CREATE TABLE "domain_dns_record" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(253) NOT NULL,
	"type" varchar(10) NOT NULL,
	"value" text NOT NULL,
	"ttl" integer DEFAULT 300 NOT NULL,
	"comment" varchar(255),
	"cloudflare_id" varchar(64),
	"sync_status" varchar(16) DEFAULT 'pending' NOT NULL,
	"sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "dns_record" CASCADE;--> statement-breakpoint
ALTER TABLE "domain_dns_record" ADD CONSTRAINT "domain_dns_record_domain_id_domain_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domain"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_dns_record" ADD CONSTRAINT "domain_dns_record_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "domain_dns_record_domain_id_idx" ON "domain_dns_record" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "domain_dns_record_name_idx" ON "domain_dns_record" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "domain_dns_record_unique_idx" ON "domain_dns_record" USING btree ("domain_id","name","type","value");
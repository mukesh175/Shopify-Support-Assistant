CREATE TABLE IF NOT EXISTS "faqs" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_domain" text NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "query_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_domain" text NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"kind" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shops" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_domain" text NOT NULL,
	"access_token_enc" text NOT NULL,
	"scope" text,
	"token_expires_at" timestamp,
	"installed_at" timestamp DEFAULT now() NOT NULL,
	"uninstalled_at" timestamp,
	"widget_enabled" boolean DEFAULT true NOT NULL,
	"brand_name" text,
	"greeting" text DEFAULT 'Hi! Ask me about your order or our policies.',
	CONSTRAINT "shops_shop_domain_unique" UNIQUE("shop_domain")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faqs_shop_idx" ON "faqs" USING btree ("shop_domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "logs_shop_idx" ON "query_logs" USING btree ("shop_domain");
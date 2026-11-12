CREATE TABLE "legal_documents" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"slug" varchar(120) NOT NULL,
	"title" varchar(160) NOT NULL,
	"content" text NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_documents_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "legal_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "legal_documents_published_title_idx" ON "legal_documents" USING btree ("published","title");
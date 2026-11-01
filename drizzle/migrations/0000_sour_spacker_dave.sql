CREATE TYPE "public"."library_category" AS ENUM('novel', 'business_plan', 'article');--> statement-breakpoint
CREATE TYPE "public"."library_purchase_status" AS ENUM('pending', 'paid', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'pending', 'paid', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."request_file_kind" AS ENUM('submission', 'delivery');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('submitted', 'under_review', 'quoted', 'awaiting_payment', 'in_progress', 'completed', 'declined', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."request_update_status" AS ENUM('submitted', 'under_review', 'quoted', 'awaiting_payment', 'in_progress', 'completed', 'declined', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'student');--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faq_entries" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"question" varchar(300) NOT NULL,
	"answer" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_purchases" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"resource_id" varchar(36) NOT NULL,
	"student_id" varchar(36) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'KES' NOT NULL,
	"status" "library_purchase_status" DEFAULT 'pending' NOT NULL,
	"payment_method" varchar(20) DEFAULT 'mpesa' NOT NULL,
	"account_reference" varchar(12),
	"phone_number" varchar(20) NOT NULL,
	"merchant_request_id" varchar(100),
	"checkout_request_id" varchar(100),
	"receipt_number" varchar(32),
	"merchant_shortcode" varchar(7),
	"transaction_timestamp" timestamp with time zone,
	"callback_response" jsonb,
	"failure_reason" varchar(255),
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "library_resources" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"category" "library_category" NOT NULL,
	"storage_key" varchar(36) NOT NULL,
	"name" varchar(255) NOT NULL,
	"size" integer NOT NULL,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'KES' NOT NULL,
	"uploaded_by" varchar(36) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"email" varchar(255) PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"request_id" varchar(36),
	"type" varchar(40) NOT NULL,
	"title" varchar(160) NOT NULL,
	"message" varchar(500) NOT NULL,
	"href" varchar(255) NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"full_name" varchar(100) DEFAULT '' NOT NULL,
	"reg_number" varchar(50),
	"email" varchar(255),
	"phone" varchar(40),
	"country" varchar(60),
	"institution" varchar(120),
	"course" varchar(120),
	"year_of_study" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_files" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"request_id" varchar(36) NOT NULL,
	"uploaded_by" varchar(36) NOT NULL,
	"storage_key" varchar(36) NOT NULL,
	"name" varchar(255) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"size" integer NOT NULL,
	"kind" "request_file_kind" DEFAULT 'submission' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_updates" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"request_id" varchar(36) NOT NULL,
	"status" "request_update_status",
	"note" text,
	"created_by" varchar(36),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"ref" varchar(20) NOT NULL,
	"student_id" varchar(36) NOT NULL,
	"service_id" varchar(36),
	"title" varchar(200) NOT NULL,
	"course_unit" varchar(120),
	"lecturer" varchar(120),
	"description" text NOT NULL,
	"num_questions" integer,
	"num_pages" integer,
	"academic_level" varchar(60),
	"deadline" timestamp with time zone,
	"preferred_date" timestamp with time zone,
	"status" "request_status" DEFAULT 'submitted' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"price" numeric(10, 2),
	"currency" varchar(3) DEFAULT 'KES' NOT NULL,
	"admin_notes" text,
	"grade" varchar(20),
	"admin_feedback" text,
	"graded_at" timestamp with time zone,
	"graded_by" varchar(36),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text NOT NULL,
	"base_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'KES' NOT NULL,
	"unit" varchar(40) DEFAULT 'per page' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"business_name" varchar(120) DEFAULT 'ScholarDesk' NOT NULL,
	"mpesa_till_number" varchar(7),
	"show_prices" boolean DEFAULT true NOT NULL,
	"contact_email" varchar(255) DEFAULT 'support@scholardesk.app' NOT NULL,
	"contact_phone" varchar(40) DEFAULT '+254 700 000 000' NOT NULL,
	"contact_whatsapp" varchar(40) DEFAULT '' NOT NULL,
	"support_hours" varchar(120) DEFAULT 'Mon-Sat, 8:00-20:00 EAT' NOT NULL,
	"footer_message" varchar(255) DEFAULT 'Thoughtful academic support, from first draft to final submission.' NOT NULL,
	"faq_title" varchar(160) DEFAULT 'Frequently asked questions' NOT NULL,
	"faq_intro" varchar(500) DEFAULT 'Answers to common questions about ScholarDesk services, payments and privacy.' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"role" "user_role" DEFAULT 'student' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_purchases" ADD CONSTRAINT "library_purchases_resource_id_library_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."library_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_purchases" ADD CONSTRAINT "library_purchases_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_resources" ADD CONSTRAINT "library_resources_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_files" ADD CONSTRAINT "request_files_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_files" ADD CONSTRAINT "request_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_updates" ADD CONSTRAINT "request_updates_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_updates" ADD CONSTRAINT "request_updates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_graded_by_users_id_fk" FOREIGN KEY ("graded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_verification_expiry_idx" ON "email_verification_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "faq_entries_active_sort_idx" ON "faq_entries" USING btree ("active","sort");--> statement-breakpoint
CREATE UNIQUE INDEX "library_purchases_checkout_unique" ON "library_purchases" USING btree ("checkout_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "library_purchases_merchant_unique" ON "library_purchases" USING btree ("merchant_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "library_purchases_receipt_unique" ON "library_purchases" USING btree ("receipt_number");--> statement-breakpoint
CREATE INDEX "library_purchases_student_status_idx" ON "library_purchases" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "library_purchases_resource_created_idx" ON "library_purchases" USING btree ("resource_id","created_at");--> statement-breakpoint
CREATE INDEX "library_purchases_status_created_idx" ON "library_purchases" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "library_resources_storage_key_unique" ON "library_resources" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "library_resources_category_created_idx" ON "library_resources" USING btree ("category","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_read_created_idx" ON "notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "password_reset_expiry_idx" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "request_files_storage_key_unique" ON "request_files" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "request_files_request_created_idx" ON "request_files" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "request_updates_request_created_idx" ON "request_updates" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "requests_ref_unique" ON "requests" USING btree ("ref");--> statement-breakpoint
CREATE INDEX "requests_student_created_idx" ON "requests" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "requests_status_idx" ON "requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "services_active_sort_idx" ON "services" USING btree ("active","sort");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expiry_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_user_role_unique" ON "user_roles" USING btree ("user_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");
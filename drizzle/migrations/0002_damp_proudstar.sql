CREATE TYPE "public"."service_request_payment_status" AS ENUM('pending', 'paid', 'failed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TABLE "service_request_payments" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"request_id" varchar(36) NOT NULL,
	"student_id" varchar(36) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'KES' NOT NULL,
	"status" "service_request_payment_status" DEFAULT 'pending' NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"account_reference" varchar(12) NOT NULL,
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
ALTER TABLE "service_request_payments" ADD CONSTRAINT "service_request_payments_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_payments" ADD CONSTRAINT "service_request_payments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_request_payments_checkout_unique" ON "service_request_payments" USING btree ("checkout_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_request_payments_merchant_unique" ON "service_request_payments" USING btree ("merchant_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_request_payments_receipt_unique" ON "service_request_payments" USING btree ("receipt_number");--> statement-breakpoint
CREATE INDEX "service_request_payments_request_created_idx" ON "service_request_payments" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "service_request_payments_student_status_idx" ON "service_request_payments" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "service_request_payments_status_created_idx" ON "service_request_payments" USING btree ("status","created_at");
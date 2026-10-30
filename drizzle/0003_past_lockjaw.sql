CREATE TABLE "indonesian_districts" (
	"code" varchar(8) PRIMARY KEY NOT NULL,
	"regency_code" varchar(5) NOT NULL,
	"name" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indonesian_provinces" (
	"code" varchar(2) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indonesian_regencies" (
	"code" varchar(5) PRIMARY KEY NOT NULL,
	"province_code" varchar(2) NOT NULL,
	"name" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indonesian_villages" (
	"code" varchar(13) PRIMARY KEY NOT NULL,
	"district_code" varchar(8) NOT NULL,
	"name" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" varchar(30) NOT NULL,
	"provider_session_id" varchar(255) NOT NULL,
	"client_token" text,
	"redirect_url" text,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider_refund_id" varchar(255),
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"reason" text,
	"restocked" boolean DEFAULT false NOT NULL,
	"status" varchar(30) DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(30) NOT NULL,
	"provider_event_id" varchar(255) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_provider_event_id_unique" UNIQUE("provider_event_id")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "guest_access_token" varchar(128) DEFAULT md5(random()::text || clock_timestamp()::text) NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_status" varchar(30) DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_provider" varchar(30);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_transaction_id" varchar(128);--> statement-breakpoint
ALTER TABLE "indonesian_districts" ADD CONSTRAINT "indonesian_districts_regency_code_indonesian_regencies_code_fk" FOREIGN KEY ("regency_code") REFERENCES "public"."indonesian_regencies"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indonesian_regencies" ADD CONSTRAINT "indonesian_regencies_province_code_indonesian_provinces_code_fk" FOREIGN KEY ("province_code") REFERENCES "public"."indonesian_provinces"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indonesian_villages" ADD CONSTRAINT "indonesian_villages_district_code_indonesian_districts_code_fk" FOREIGN KEY ("district_code") REFERENCES "public"."indonesian_districts"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "districts_regency_idx" ON "indonesian_districts" USING btree ("regency_code");--> statement-breakpoint
CREATE INDEX "regencies_province_idx" ON "indonesian_regencies" USING btree ("province_code");--> statement-breakpoint
CREATE INDEX "villages_district_idx" ON "indonesian_villages" USING btree ("district_code");--> statement-breakpoint
CREATE INDEX "payment_sessions_order_idx" ON "payment_sessions" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_sessions_provider_sess_idx" ON "payment_sessions" USING btree ("provider","provider_session_id");--> statement-breakpoint
CREATE INDEX "refunds_order_idx" ON "refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "webhook_events_provider_idx" ON "webhook_events" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_id_idx" ON "webhook_events" USING btree ("provider","provider_event_id");
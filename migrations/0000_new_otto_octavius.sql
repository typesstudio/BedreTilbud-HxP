CREATE TABLE "benchmark_prices" (
	"policy_type" text PRIMARY KEY NOT NULL,
	"annual_premium" integer NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"description" text,
	"logo_url" text,
	"popular" boolean DEFAULT false,
	"active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "company_comparisons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"current_company" text NOT NULL,
	"offer_company" text NOT NULL,
	"status" text DEFAULT 'pending',
	"status_reason" text,
	"comparison_json" jsonb,
	"error_message" text,
	"notified_at" timestamp,
	"is_superseded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "comparisons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"current_document_id" varchar,
	"offer_document_id" varchar,
	"company_id" varchar,
	"policy_type" text,
	"current_policy_id" varchar,
	"offer_policy_id" varchar,
	"comparison_data" json,
	"ai_recommendation" text,
	"savings" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"file_hash" text,
	"ocr_data" json,
	"ocr_raw_response" json,
	"extraction_status" text DEFAULT 'pending',
	"error_reason" text,
	"total_policies_extracted" integer DEFAULT 0,
	"document_type" text,
	"company_id" varchar,
	"extraction_stages" jsonb,
	"document_kind" text DEFAULT 'insurance_policy',
	"document_kind_confidence" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_threads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"company_id" varchar,
	"subject" text,
	"thread_id" text,
	"request_token" varchar(12),
	"reply_to_email" varchar(255),
	"status" text DEFAULT 'sent',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "email_threads_request_token_unique" UNIQUE("request_token")
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" varchar,
	"message_id" text,
	"email_message_id" text,
	"direction" text,
	"subject" text,
	"body" text,
	"attachments" json,
	"metadata" json,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "health_checks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"snapshot_id" varchar,
	"policy_type" text NOT NULL,
	"data_source" text NOT NULL,
	"confidence_score" integer,
	"result" json NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "household_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"relationship" text,
	"date_of_birth" text,
	"avatar_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "magic_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"comparison_id" varchar,
	"token" text NOT NULL,
	"redirect_path" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "magic_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"comparison_id" varchar,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "offer_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"policy_id" varchar,
	"policy_type" text NOT NULL,
	"company_id" varchar,
	"premium" numeric(10, 2),
	"deductible" numeric(10, 2),
	"coverage_details" json NOT NULL,
	"structured_policy" jsonb,
	"extraction_version" text NOT NULL,
	"extractor_model" text NOT NULL,
	"extractor_provider" text NOT NULL,
	"confidence_score" integer,
	"validation_status" text DEFAULT 'pending' NOT NULL,
	"validation_errors" json,
	"source_page_range" text,
	"raw_extracted_data" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"user_id" varchar,
	"current_step" integer DEFAULT 1,
	"completed_steps" json DEFAULT '[]'::json,
	"selected_company_ids" json DEFAULT '[]'::json,
	"document_id" varchar,
	"name" text,
	"cpr" text,
	"priority" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"company_id" varchar,
	"policy_type" text NOT NULL,
	"is_own_policy" boolean DEFAULT true,
	"premium" numeric(10, 2),
	"deductible" numeric(10, 2),
	"coverage_details" json,
	"source_page_range" text,
	"extraction_confidence" integer,
	"health_check_status" text DEFAULT 'pending',
	"health_check_payload" json,
	"health_check_savings_annual" numeric(10, 2),
	"health_check_updated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "policy_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"user_id" varchar,
	"kind" text NOT NULL,
	"company_name" text NOT NULL,
	"policy_type" text NOT NULL,
	"coverage_address" text,
	"status" text DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"raw_text" text NOT NULL,
	"structured_policy" jsonb,
	"pricing" jsonb,
	"health_check_json" jsonb,
	"source_segment_meta" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text,
	"phone" text,
	"date_of_birth" text,
	"address" text,
	"personal_id_number" text,
	"housing_type" text,
	"has_car" boolean,
	"deductible" text,
	"age" text,
	"additional_info" text,
	"insurance_types" text[],
	"priority_one" text,
	"priority_two" text,
	"priority_three" text,
	"insurance_priority" text,
	"ai_auto_response_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "company_comparisons" ADD CONSTRAINT "company_comparisons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_current_document_id_documents_id_fk" FOREIGN KEY ("current_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_offer_document_id_documents_id_fk" FOREIGN KEY ("offer_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_current_policy_id_policies_id_fk" FOREIGN KEY ("current_policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_offer_policy_id_policies_id_fk" FOREIGN KEY ("offer_policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_thread_id_email_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."email_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_checks" ADD CONSTRAINT "health_checks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_checks" ADD CONSTRAINT "health_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_comparison_id_company_comparisons_id_fk" FOREIGN KEY ("comparison_id") REFERENCES "public"."company_comparisons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comparison_id_company_comparisons_id_fk" FOREIGN KEY ("comparison_id") REFERENCES "public"."company_comparisons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_snapshots" ADD CONSTRAINT "offer_snapshots_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_snapshots" ADD CONSTRAINT "offer_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_snapshots" ADD CONSTRAINT "offer_snapshots_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_snapshots" ADD CONSTRAINT "offer_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_snapshots" ADD CONSTRAINT "policy_snapshots_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_snapshots" ADD CONSTRAINT "policy_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_comparisons_user_id_idx" ON "company_comparisons" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "company_comparisons_status_idx" ON "company_comparisons" USING btree ("status");--> statement-breakpoint
CREATE INDEX "company_comparisons_user_id_created_idx" ON "company_comparisons" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "company_comparisons_user_id_status_idx" ON "company_comparisons" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "company_comparisons_is_superseded_idx" ON "company_comparisons" USING btree ("is_superseded");--> statement-breakpoint
CREATE INDEX "comparisons_user_id_idx" ON "comparisons" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "comparisons_company_id_idx" ON "comparisons" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "comparisons_policy_type_idx" ON "comparisons" USING btree ("policy_type");--> statement-breakpoint
CREATE INDEX "comparisons_current_policy_id_idx" ON "comparisons" USING btree ("current_policy_id");--> statement-breakpoint
CREATE INDEX "comparisons_offer_policy_id_idx" ON "comparisons" USING btree ("offer_policy_id");--> statement-breakpoint
CREATE INDEX "comparisons_user_id_company_created_idx" ON "comparisons" USING btree ("user_id","company_id","created_at");--> statement-breakpoint
CREATE INDEX "comparisons_user_id_created_idx" ON "comparisons" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "comparisons_user_id_company_type_idx" ON "comparisons" USING btree ("user_id","company_id","policy_type");--> statement-breakpoint
CREATE INDEX "documents_user_id_idx" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_document_type_idx" ON "documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "documents_company_id_idx" ON "documents" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "documents_user_id_type_idx" ON "documents" USING btree ("user_id","document_type");--> statement-breakpoint
CREATE INDEX "documents_user_id_file_hash_idx" ON "documents" USING btree ("user_id","file_hash");--> statement-breakpoint
CREATE INDEX "documents_document_kind_idx" ON "documents" USING btree ("document_kind");--> statement-breakpoint
CREATE INDEX "email_threads_user_id_idx" ON "email_threads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_threads_company_id_idx" ON "email_threads" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "email_threads_request_token_idx" ON "email_threads" USING btree ("request_token");--> statement-breakpoint
CREATE INDEX "email_threads_thread_id_idx" ON "email_threads" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "email_threads_user_id_status_idx" ON "email_threads" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "email_threads_user_id_created_idx" ON "email_threads" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "emails_thread_id_idx" ON "emails" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "emails_message_id_idx" ON "emails" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "emails_thread_id_sent_at_idx" ON "emails" USING btree ("thread_id","sent_at");--> statement-breakpoint
CREATE INDEX "health_checks_document_id_idx" ON "health_checks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "health_checks_user_id_idx" ON "health_checks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "health_checks_snapshot_id_idx" ON "health_checks" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "health_checks_policy_type_idx" ON "health_checks" USING btree ("policy_type");--> statement-breakpoint
CREATE INDEX "health_checks_user_id_created_idx" ON "health_checks" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "household_members_user_id_idx" ON "household_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "magic_links_token_idx" ON "magic_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "magic_links_user_id_idx" ON "magic_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "magic_links_expires_at_idx" ON "magic_links" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_comparison_id_idx" ON "notifications" USING btree ("comparison_id");--> statement-breakpoint
CREATE INDEX "notifications_status_idx" ON "notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_type_idx" ON "notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "offer_snapshots_document_id_idx" ON "offer_snapshots" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "offer_snapshots_user_id_idx" ON "offer_snapshots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "offer_snapshots_policy_id_idx" ON "offer_snapshots" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "offer_snapshots_extraction_version_idx" ON "offer_snapshots" USING btree ("extraction_version");--> statement-breakpoint
CREATE INDEX "offer_snapshots_validation_status_idx" ON "offer_snapshots" USING btree ("validation_status");--> statement-breakpoint
CREATE INDEX "offer_snapshots_document_id_type_idx" ON "offer_snapshots" USING btree ("document_id","policy_type");--> statement-breakpoint
CREATE INDEX "offer_snapshots_user_id_type_idx" ON "offer_snapshots" USING btree ("user_id","policy_type");--> statement-breakpoint
CREATE INDEX "onboarding_progress_email_idx" ON "onboarding_progress" USING btree ("email");--> statement-breakpoint
CREATE INDEX "onboarding_progress_user_id_idx" ON "onboarding_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "policies_user_id_idx" ON "policies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "policies_document_id_idx" ON "policies" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "policies_policy_type_idx" ON "policies" USING btree ("policy_type");--> statement-breakpoint
CREATE INDEX "policies_health_check_status_idx" ON "policies" USING btree ("health_check_status");--> statement-breakpoint
CREATE INDEX "policies_user_id_policy_type_idx" ON "policies" USING btree ("user_id","policy_type");--> statement-breakpoint
CREATE INDEX "policies_user_id_is_own_idx" ON "policies" USING btree ("user_id","is_own_policy");--> statement-breakpoint
CREATE INDEX "policy_snapshots_document_id_idx" ON "policy_snapshots" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "policy_snapshots_user_id_idx" ON "policy_snapshots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "policy_snapshots_kind_idx" ON "policy_snapshots" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "policy_snapshots_policy_type_idx" ON "policy_snapshots" USING btree ("policy_type");--> statement-breakpoint
CREATE INDEX "policy_snapshots_company_name_idx" ON "policy_snapshots" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "policy_snapshots_user_id_kind_idx" ON "policy_snapshots" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "policy_snapshots_user_id_kind_type_idx" ON "policy_snapshots" USING btree ("user_id","kind","policy_type");--> statement-breakpoint
CREATE INDEX "policy_snapshots_user_id_kind_company_idx" ON "policy_snapshots" USING btree ("user_id","kind","company_name");--> statement-breakpoint
CREATE INDEX "policy_snapshots_user_id_kind_active_idx" ON "policy_snapshots" USING btree ("user_id","kind","is_active");--> statement-breakpoint
CREATE INDEX "policy_snapshots_user_id_kind_type_active_idx" ON "policy_snapshots" USING btree ("user_id","kind","policy_type","is_active");--> statement-breakpoint
CREATE INDEX "policy_snapshots_status_idx" ON "policy_snapshots" USING btree ("status");--> statement-breakpoint
CREATE INDEX "policy_snapshots_user_id_kind_status_idx" ON "policy_snapshots" USING btree ("user_id","kind","status");
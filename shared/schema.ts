import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json, jsonb, boolean, integer, numeric, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"), // Bcrypt hashed password
  name: text("name"),
  phone: text("phone"),
  dateOfBirth: text("date_of_birth"),
  address: text("address"),
  personalIdNumber: text("personal_id_number"),
  housingType: text("housing_type"),
  hasCar: boolean("has_car"),
  deductible: text("deductible"),
  age: text("age"),
  additionalInfo: text("additional_info"),
  insuranceTypes: text("insurance_types").array(),
  priorityOne: text("priority_one"),
  priorityTwo: text("priority_two"),
  priorityThree: text("priority_three"),
  insurancePriority: text("insurance_priority"), // "cheap", "coverage", or "convenience" from onboarding
  aiAutoResponseEnabled: boolean("ai_auto_response_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  description: text("description"),
  logoUrl: text("logo_url"), // Company logo URL
  popular: boolean("popular").default(false), // Mark popular companies
  active: boolean("active").default(true),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  ocrData: json("ocr_data"),
  ocrRawResponse: json("ocr_raw_response"), // Store full Mistral OCR response for re-parsing
  extractionStatus: text("extraction_status").default("pending"), // "pending", "processing", "completed", "failed"
  totalPoliciesExtracted: integer("total_policies_extracted").default(0),
  documentType: text("document_type"), // "current" or "offer"
  companyId: varchar("company_id").references(() => companies.id),
  extractionStages: jsonb("extraction_stages"), // Debug data: { stage1_ocr, stage2_segmentation, stage3_extraction }
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("documents_user_id_idx").on(table.userId),
  documentTypeIdx: index("documents_document_type_idx").on(table.documentType),
  companyIdIdx: index("documents_company_id_idx").on(table.companyId),
  userIdTypeIdx: index("documents_user_id_type_idx").on(table.userId, table.documentType),
}));

export const emailThreads = pgTable("email_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  companyId: varchar("company_id").references(() => companies.id),
  subject: text("subject"),
  threadId: text("thread_id"), // Gmail thread ID
  requestToken: varchar("request_token", { length: 12 }).unique(), // Unique token for tracking
  replyToEmail: varchar("reply_to_email", { length: 255 }), // TOKEN@bedretilbud.com
  status: text("status").default("sent"), // "sent", "pending", "received"
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("email_threads_user_id_idx").on(table.userId),
  companyIdIdx: index("email_threads_company_id_idx").on(table.companyId),
  requestTokenIdx: index("email_threads_request_token_idx").on(table.requestToken),
  threadIdIdx: index("email_threads_thread_id_idx").on(table.threadId),
  // Composite indexes for common query patterns
  userIdStatusIdx: index("email_threads_user_id_status_idx").on(table.userId, table.status),
  userIdCreatedIdx: index("email_threads_user_id_created_idx").on(table.userId, table.createdAt),
}));

export const emails = pgTable("emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").references(() => emailThreads.id),
  messageId: text("message_id"), // Gmail message ID
  emailMessageId: text("email_message_id"), // RFC Message-ID header for email threading
  direction: text("direction"), // "outbound", "inbound", "auto"
  subject: text("subject"),
  body: text("body"),
  attachments: json("attachments"),
  metadata: json("metadata"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  threadIdIdx: index("emails_thread_id_idx").on(table.threadId),
  messageIdIdx: index("emails_message_id_idx").on(table.messageId),
  // Composite index for efficient sorting in JOIN queries
  threadIdSentAtIdx: index("emails_thread_id_sent_at_idx").on(table.threadId, table.sentAt),
}));

export const comparisons = pgTable("comparisons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  currentDocumentId: varchar("current_document_id").references(() => documents.id),
  offerDocumentId: varchar("offer_document_id").references(() => documents.id),
  companyId: varchar("company_id").references(() => companies.id),
  
  // New fields for per-type comparisons
  policyType: text("policy_type"), // "indbo", "ulykke", "hus", "bil", "rejse", "other"
  currentPolicyId: varchar("current_policy_id").references(() => policies.id),
  offerPolicyId: varchar("offer_policy_id").references(() => policies.id),
  
  comparisonData: json("comparison_data"),
  aiRecommendation: text("ai_recommendation"),
  savings: integer("savings"), // in DKK
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("comparisons_user_id_idx").on(table.userId),
  companyIdIdx: index("comparisons_company_id_idx").on(table.companyId),
  policyTypeIdx: index("comparisons_policy_type_idx").on(table.policyType),
  currentPolicyIdIdx: index("comparisons_current_policy_id_idx").on(table.currentPolicyId),
  offerPolicyIdIdx: index("comparisons_offer_policy_id_idx").on(table.offerPolicyId),
  // Composite indexes for efficient querying
  userIdCompanyCreatedIdx: index("comparisons_user_id_company_created_idx").on(table.userId, table.companyId, table.createdAt),
  userIdCreatedIdx: index("comparisons_user_id_created_idx").on(table.userId, table.createdAt),
  userIdCompanyTypeIdx: index("comparisons_user_id_company_type_idx").on(table.userId, table.companyId, table.policyType),
}));

// NEW: Company-level comparisons from Phase 4 (ComparisonAgent)
export const companyComparisons = pgTable("company_comparisons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  currentCompany: text("current_company").notNull(), // Company ID (UUID from companies table)
  offerCompany: text("offer_company").notNull(), // Company ID (UUID from companies table)
  status: text("status").default("pending"), // "pending", "processing", "completed", "failed"
  statusReason: text("status_reason"), // Machine-readable reason: MISSING_STRUCTURED_POLICY_CURRENT, MISSING_STRUCTURED_POLICY_OFFER, etc.
  comparisonJSON: jsonb("comparison_json"), // Full ComparisonResult from Phase 4
  errorMessage: text("error_message"), // Error details if failed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("company_comparisons_user_id_idx").on(table.userId),
  statusIdx: index("company_comparisons_status_idx").on(table.status),
  userIdCreatedIdx: index("company_comparisons_user_id_created_idx").on(table.userId, table.createdAt),
  userIdStatusIdx: index("company_comparisons_user_id_status_idx").on(table.userId, table.status),
}));

export const householdMembers = pgTable("household_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  relationship: text("relationship"), // "spouse", "child", etc.
  dateOfBirth: text("date_of_birth"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("household_members_user_id_idx").on(table.userId),
}));

export const policies = pgTable("policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  companyId: varchar("company_id").references(() => companies.id),
  policyType: text("policy_type").notNull(), // "indbo", "ulykke", "hus", "bil", "rejse", "other"
  isOwnPolicy: boolean("is_own_policy").default(true), // true = user's current policy, false = offer from company
  
  // Core policy data
  premium: numeric("premium", { precision: 10, scale: 2 }), // Annual premium in DKK
  deductible: numeric("deductible", { precision: 10, scale: 2 }), // Deductible in DKK
  coverageDetails: json("coverage_details"), // Full coverage information
  
  // Extraction metadata
  sourcePageRange: text("source_page_range"), // e.g., "1-3" for traceability
  extractionConfidence: integer("extraction_confidence"), // 0-100 score from AI
  
  // Health check caching
  healthCheckStatus: text("health_check_status").default("pending"), // "pending", "processing", "completed", "failed"
  healthCheckPayload: json("health_check_payload"), // Complete health check results
  healthCheckSavingsAnnual: numeric("health_check_savings_annual", { precision: 10, scale: 2 }), // Potential annual savings in DKK
  healthCheckUpdatedAt: timestamp("health_check_updated_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("policies_user_id_idx").on(table.userId),
  documentIdIdx: index("policies_document_id_idx").on(table.documentId),
  policyTypeIdx: index("policies_policy_type_idx").on(table.policyType),
  healthCheckStatusIdx: index("policies_health_check_status_idx").on(table.healthCheckStatus),
  userIdPolicyTypeIdx: index("policies_user_id_policy_type_idx").on(table.userId, table.policyType),
  userIdIsOwnIdx: index("policies_user_id_is_own_idx").on(table.userId, table.isOwnPolicy),
}));

export const offerSnapshots = pgTable("offer_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  policyId: varchar("policy_id").references(() => policies.id), // Link to created policy if applicable
  
  // Policy data (normalized and validated)
  policyType: text("policy_type").notNull(), // "indbo", "ulykke", "hus", "bil", "rejse", "other"
  companyId: varchar("company_id").references(() => companies.id),
  premium: numeric("premium", { precision: 10, scale: 2 }), // Annual premium in DKK (normalized)
  deductible: numeric("deductible", { precision: 10, scale: 2 }), // Deductible in DKK (normalized)
  coverageDetails: json("coverage_details").notNull(), // Structured coverage data (legacy)
  
  // Two-Phase Extraction Architecture (NEW - Nov 2025)
  structuredPolicy: jsonb("structured_policy"), // Phase 1 extraction output with mainCoverages/additionalCoverages
  
  // Extraction provenance
  extractionVersion: text("extraction_version").notNull(), // "v1", "v2", etc. for tracking schema changes
  extractorModel: text("extractor_model").notNull(), // "mistral-large-latest", "gpt-4o-mini", etc.
  extractorProvider: text("extractor_provider").notNull(), // "mistral", "openai"
  
  // Quality metrics
  confidenceScore: integer("confidence_score"), // 0-100 overall extraction confidence
  validationStatus: text("validation_status").notNull().default("pending"), // "pending", "validated", "failed", "manual_review"
  validationErrors: json("validation_errors"), // Array of validation error objects
  
  // Source traceability
  sourcePageRange: text("source_page_range"), // e.g., "1-3" from PDF
  rawExtractedData: json("raw_extracted_data"), // Original AI output before normalization
  
  // Audit trail
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  documentIdIdx: index("offer_snapshots_document_id_idx").on(table.documentId),
  userIdIdx: index("offer_snapshots_user_id_idx").on(table.userId),
  policyIdIdx: index("offer_snapshots_policy_id_idx").on(table.policyId),
  extractionVersionIdx: index("offer_snapshots_extraction_version_idx").on(table.extractionVersion),
  validationStatusIdx: index("offer_snapshots_validation_status_idx").on(table.validationStatus),
  // Composite indexes for common queries
  documentIdTypeIdx: index("offer_snapshots_document_id_type_idx").on(table.documentId, table.policyType),
  userIdTypeIdx: index("offer_snapshots_user_id_type_idx").on(table.userId, table.policyType),
}));

export const onboardingProgress = pgTable("onboarding_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  userId: varchar("user_id").references(() => users.id), // Populated after user created
  currentStep: integer("current_step").default(1), // 1, 2, or 3
  completedSteps: json("completed_steps").default([]), // Array of completed step numbers
  selectedCompanyIds: json("selected_company_ids").default([]), // Array of company IDs
  documentId: varchar("document_id").references(() => documents.id), // Uploaded document
  name: text("name"), // From step 3
  cpr: text("cpr"), // From step 3
  priority: text("priority"), // "cheap", "coverage", or "convenience"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  emailIdx: index("onboarding_progress_email_idx").on(table.email),
  userIdIdx: index("onboarding_progress_user_id_idx").on(table.userId),
}));

export const healthChecks = pgTable("health_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  snapshotId: varchar("snapshot_id").references(() => offerSnapshots.id), // Phase 2: FK to offer_snapshots for ID-based matching
  dataSource: text("data_source").notNull(), // "OfferSnapshot", "Policy", "ocrData"
  confidenceScore: integer("confidence_score"), // 0-100 if from OfferSnapshot
  result: json("result").notNull(), // HealthCheckResult object
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  documentIdIdx: index("health_checks_document_id_idx").on(table.documentId),
  userIdIdx: index("health_checks_user_id_idx").on(table.userId),
  snapshotIdIdx: index("health_checks_snapshot_id_idx").on(table.snapshotId),
  userIdCreatedIdx: index("health_checks_user_id_created_idx").on(table.userId, table.createdAt),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export const insertEmailThreadSchema = createInsertSchema(emailThreads).omit({
  id: true,
  createdAt: true,
});

export const insertEmailSchema = createInsertSchema(emails).omit({
  id: true,
  createdAt: true,
});

export const insertComparisonSchema = createInsertSchema(comparisons).omit({
  id: true,
  createdAt: true,
});

export const insertHouseholdMemberSchema = createInsertSchema(householdMembers).omit({
  id: true,
  createdAt: true,
});

export const insertOnboardingProgressSchema = createInsertSchema(onboardingProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPolicySchema = createInsertSchema(policies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOfferSnapshotSchema = createInsertSchema(offerSnapshots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHealthCheckSchema = createInsertSchema(healthChecks).omit({
  id: true,
  createdAt: true,
});

export const insertCompanyComparisonSchema = createInsertSchema(companyComparisons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type EmailThread = typeof emailThreads.$inferSelect;
export type InsertEmailThread = z.infer<typeof insertEmailThreadSchema>;
export type Email = typeof emails.$inferSelect;
export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type Comparison = typeof comparisons.$inferSelect;
export type InsertComparison = z.infer<typeof insertComparisonSchema>;
export type HouseholdMember = typeof householdMembers.$inferSelect;
export type InsertHouseholdMember = z.infer<typeof insertHouseholdMemberSchema>;
export type Policy = typeof policies.$inferSelect;
export type InsertPolicy = z.infer<typeof insertPolicySchema>;
export type OfferSnapshot = typeof offerSnapshots.$inferSelect;
export type InsertOfferSnapshot = z.infer<typeof insertOfferSnapshotSchema>;
export type OnboardingProgress = typeof onboardingProgress.$inferSelect;
export type InsertOnboardingProgress = z.infer<typeof insertOnboardingProgressSchema>;
export type HealthCheck = typeof healthChecks.$inferSelect;
export type InsertHealthCheck = z.infer<typeof insertHealthCheckSchema>;
export type CompanyComparison = typeof companyComparisons.$inferSelect;
export type InsertCompanyComparison = z.infer<typeof insertCompanyComparisonSchema>;

// ============================================================================
// COMPARISON DATA STRUCTURES (Phase 3 + 4)
// Based on expert spec for comparison flow
// ============================================================================

// Phase 3: Matched policy pairs
export const matchedPairSchema = z.object({
  policyType: z.enum(["hus", "indbo", "ulykke", "bil", "rejse", "andet"]),
  label: z.string(), // Display label e.g., "Hus"
  currentPolicyId: z.string().nullable(),
  offerPolicyId: z.string().nullable(),
});

export type MatchedPair = z.infer<typeof matchedPairSchema>;

export const policyMatchResultSchema = z.object({
  currentCompany: z.string(),
  offerCompany: z.string(),
  pairs: z.array(matchedPairSchema),
  unmatchedCurrent: z.array(z.string()), // Policy IDs
  unmatchedOffer: z.array(z.string()), // Policy IDs
});

export type PolicyMatchResult = z.infer<typeof policyMatchResultSchema>;

// Phase 4: Comparison output structures
export const highlightSchema = z.object({
  title: z.string(),
  description: z.string(),
  icon: z.enum(["trending-up", "shield", "zap", "car", "droplet", "info"]),
  variant: z.enum(["success", "warning", "error", "neutral"]),
  category: z.enum(["coverage", "price", "deductible", "feature"]),
});

export type Highlight = z.infer<typeof highlightSchema>;

export const missingInformationItemSchema = z.object({
  severity: z.enum(["critical", "important", "question"]),
  question: z.string(),
  explanation: z.string(),
});

export type MissingInformationItem = z.infer<typeof missingInformationItemSchema>;

export const coverageComparisonRowSchema = z.object({
  coverage: z.string(), // Coverage name/title
  description: z.string(),
  current: z.object({
    value: z.string(), // "inkluderet" | "ikke inkluderet" | "ukendt"
    limit: z.string().nullable(),
    selvrisiko: z.string().nullable(),
    status: z.enum(["success", "warning", "error", "neutral"]),
  }),
  offer: z.object({
    value: z.string(),
    limit: z.string().nullable(),
    selvrisiko: z.string().nullable(),
    status: z.enum(["success", "warning", "error", "neutral"]),
  }),
  note: z.string().nullable(),
});

export type CoverageComparisonRow = z.infer<typeof coverageComparisonRowSchema>;

export const perPolicySummarySchema = z.object({
  policyType: z.string(),
  label: z.string(),
  currentAnnualPremium: z.number(),
  offerAnnualPremium: z.number(),
  annualSavings: z.number(),
  annualSavingsPercent: z.number(),
});

export type PerPolicySummary = z.infer<typeof perPolicySummarySchema>;

export const overallComparisonSchema = z.object({
  totalCurrentAnnualPremium: z.number(),
  totalOfferAnnualPremium: z.number(),
  annualSavings: z.number(),
  annualSavingsPercent: z.number(),
  explanation: z.string(),
  perPolicySummary: z.array(perPolicySummarySchema),
  globalHighlights: z.array(highlightSchema),
});

export type OverallComparison = z.infer<typeof overallComparisonSchema>;

export const policyComparisonSchema = z.object({
  policyType: z.string(),
  label: z.string(),
  currentCompany: z.string(),
  offerCompany: z.string(),
  costSummary: z.object({
    currentAnnualPremium: z.number(),
    offerAnnualPremium: z.number(),
    annualSavings: z.number(),
    annualSavingsPercent: z.number(),
  }),
  highlights: z.array(highlightSchema),
  coverageComparison: z.object({
    rows: z.array(coverageComparisonRowSchema),
  }),
  missingInformation: z.array(missingInformationItemSchema),
  recommendations: z.array(z.string()),
});

export type PolicyComparison = z.infer<typeof policyComparisonSchema>;

export const cumulativeSavingsSchema = z.object({
  totalOver10Years: z.number(),
  monthlyRange: z.object({
    min: z.number(),
    max: z.number(),
  }),
  after12Months: z.number(),
  after10Years: z.number(),
  chartData: z.array(z.object({
    month: z.string(),
    savings: z.number(),
  })),
});

export type CumulativeSavings = z.infer<typeof cumulativeSavingsSchema>;

// Complete comparison result from Phase 4 (ComparisonAgent output)
export const comparisonResultSchema = z.object({
  overall: overallComparisonSchema,
  policyComparisons: z.array(policyComparisonSchema),
  cumulativeSavings: cumulativeSavingsSchema,
  meta: z.object({
    currentCompany: z.string(),
    offerCompany: z.string(),
  }),
});

export type ComparisonResult = z.infer<typeof comparisonResultSchema>;

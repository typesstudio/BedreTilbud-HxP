import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json, boolean, integer, numeric, index } from "drizzle-orm/pg-core";
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
  comparisonData: json("comparison_data"),
  aiRecommendation: text("ai_recommendation"),
  savings: integer("savings"), // in DKK
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("comparisons_user_id_idx").on(table.userId),
  companyIdIdx: index("comparisons_company_id_idx").on(table.companyId),
  // Composite indexes for efficient querying
  userIdCompanyCreatedIdx: index("comparisons_user_id_company_created_idx").on(table.userId, table.companyId, table.createdAt),
  userIdCreatedIdx: index("comparisons_user_id_created_idx").on(table.userId, table.createdAt),
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
export type OnboardingProgress = typeof onboardingProgress.$inferSelect;
export type InsertOnboardingProgress = z.infer<typeof insertOnboardingProgressSchema>;

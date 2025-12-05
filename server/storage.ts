import { 
  type User, 
  type InsertUser,
  type Company,
  type InsertCompany,
  type Document,
  type InsertDocument,
  type EmailThread,
  type InsertEmailThread,
  type Email,
  type InsertEmail,
  type Comparison,
  type InsertComparison,
  type CompanyComparison,
  type InsertCompanyComparison,
  type HouseholdMember,
  type InsertHouseholdMember,
  type ComparisonCurrentSnapshot,
  type InsertComparisonCurrentSnapshot,
  type Policy,
  type InsertPolicy,
  type OfferSnapshot,
  type InsertOfferSnapshot,
  type HealthCheck,
  type InsertHealthCheck,
  type OnboardingProgress,
  type InsertOnboardingProgress,
  type MagicLink,
  type InsertMagicLink,
  type Notification,
  type InsertNotification,
  type AiDebugReport,
  type InsertAiDebugReport
} from "@shared/schema";
import { randomUUID } from "crypto";
import { withCache, apiCache } from "./utils/cache";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;

  // Companies
  getCompany(id: string): Promise<Company | undefined>;
  getActiveCompanies(): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;

  // Documents
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentByFileHash(userId: string, fileHash: string): Promise<Document | undefined>;
  getOfferDocumentByUserCompanyAndHash(userId: string, companyId: string, fileHash: string): Promise<Document | undefined>;
  getUserDocuments(userId: string, documentType?: string, limit?: number, offset?: number): Promise<Document[]>;
  countUserDocuments(userId: string, documentType?: string): Promise<number>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document>;
  updateDocumentExtractionStages(id: string, stagesData: any): Promise<void>;
  deleteDocument(id: string): Promise<void>;

  // Email Threads
  getEmailThread(id: string): Promise<EmailThread | undefined>;
  getEmailThreadByGmailId(gmailThreadId: string): Promise<EmailThread | undefined>;
  getEmailThreadByToken(token: string): Promise<EmailThread | undefined>;
  getEmailThreadByCompany(userId: string, companyId: string): Promise<EmailThread | undefined>;
  getUserEmailThreads(userId: string): Promise<EmailThread[]>;
  getUserEmailThreadsEnriched(userId: string, limit?: number, offset?: number): Promise<Array<EmailThread & { company: Company | null; emailCount: number; lastEmailAt: Date | null }>>;
  getAllEmailThreadsEnriched(limit?: number, offset?: number): Promise<Array<EmailThread & { company: Company | null; user: User | null; emailCount: number; lastEmailAt: Date | null }>>;
  createEmailThread(thread: InsertEmailThread): Promise<EmailThread>;
  updateEmailThread(id: string, updates: Partial<InsertEmailThread>): Promise<EmailThread>;

  // Emails
  getEmail(id: string): Promise<Email | undefined>;
  getEmailById(id: string): Promise<Email | undefined>;
  getEmailWithThread(id: string): Promise<{ email: Email; thread: EmailThread } | undefined>;
  getThreadEmails(threadId: string, direction?: string): Promise<Email[]>;
  getThreadDraftEmails(threadId: string): Promise<Email[]>;
  getDraftEmailsByUser(userId: string): Promise<Array<Email & { thread: EmailThread; company: Company | null }>>;
  getAllDraftEmails(): Promise<Array<Email & { thread: EmailThread; company: Company | null; user: User | null }>>;
  createEmail(email: InsertEmail): Promise<Email>;
  updateEmail(id: string, updates: Partial<InsertEmail>): Promise<Email>;
  
  // AI Debug Reports
  createAiDebugReport(report: InsertAiDebugReport): Promise<AiDebugReport>;
  getAiDebugReports(threadId?: string, limit?: number): Promise<AiDebugReport[]>;
  getAiDebugReportByMessageId(aiMessageId: string): Promise<AiDebugReport | undefined>;

  // Comparisons
  getComparison(id: string): Promise<Comparison | undefined>;
  getUserComparisons(userId: string): Promise<Comparison[]>;
  getComparisonByUserAndCompany(userId: string, companyId: string): Promise<Comparison | undefined>;
  getComparisonsByUserAndCompany(userId: string, companyId: string): Promise<Comparison[]>;
  getComparisonsByOfferDocument(offerDocumentId: string): Promise<Comparison[]>;
  createComparison(comparison: InsertComparison): Promise<Comparison>;

  // Company Comparisons (Phase 4)
  getCompanyComparison(id: string): Promise<CompanyComparison | undefined>;
  getCompanyComparisonsByUser(userId: string): Promise<CompanyComparison[]>;
  getActiveCompanyComparisonsByUser(userId: string): Promise<CompanyComparison[]>;
  getCompanyComparisonByCompanies(userId: string, currentCompany: string, offerCompany: string): Promise<CompanyComparison | undefined>;
  createCompanyComparison(comparison: InsertCompanyComparison): Promise<CompanyComparison>;
  updateCompanyComparisonStatus(id: string, status: string, comparisonJSON?: any, errorMessage?: string, statusReason?: string): Promise<CompanyComparison>;
  supersedeCompanyComparisons(userId: string, currentCompany: string, offerCompany: string): Promise<number>;

  // Household Members
  getHouseholdMember(id: string): Promise<HouseholdMember | undefined>;
  getUserHouseholdMembers(userId: string): Promise<HouseholdMember[]>;
  createHouseholdMember(member: InsertHouseholdMember): Promise<HouseholdMember>;
  updateHouseholdMember(id: string, updates: Partial<InsertHouseholdMember>): Promise<HouseholdMember>;
  deleteHouseholdMember(id: string): Promise<void>;
  
  // Comparison Current Snapshots (Step 5.3)
  getComparisonCurrentSnapshots(comparisonId: string): Promise<ComparisonCurrentSnapshot[]>;
  createComparisonCurrentSnapshot(snapshot: InsertComparisonCurrentSnapshot): Promise<ComparisonCurrentSnapshot>;
  freezeCurrentSnapshotsForComparison(comparisonId: string, userId: string): Promise<ComparisonCurrentSnapshot[]>;

  // Policies
  getPolicy(id: string): Promise<Policy | undefined>;
  getPoliciesByUser(userId: string): Promise<Policy[]>;
  getPoliciesByTypeAndUser(userId: string, policyType: string, isOwnPolicy?: boolean): Promise<Policy[]>;
  getPoliciesByDocument(documentId: string): Promise<Policy[]>;
  createPolicy(policy: InsertPolicy): Promise<Policy>;
  updatePolicy(id: string, updates: Partial<InsertPolicy>): Promise<Policy>;
  updatePolicyHealthCheck(id: string, healthCheckData: {
    status: string;
    payload: any;
    savingsAnnual: number;
  }): Promise<Policy>;
  deletePolicy(id: string): Promise<void>;
  detectDuplicatePolicies(userId: string, policyType: string, companyId: string | null, premium: number | null): Promise<Policy[]>;

  // Offer Snapshots
  getOfferSnapshot(id: string): Promise<OfferSnapshot | undefined>;
  getOfferSnapshotsByDocument(documentId: string): Promise<OfferSnapshot[]>;
  getOfferSnapshotsByUser(userId: string, validationStatus?: string): Promise<OfferSnapshot[]>;
  getOfferSnapshotByPolicy(policyId: string): Promise<OfferSnapshot | undefined>;
  createOfferSnapshot(snapshot: InsertOfferSnapshot): Promise<OfferSnapshot>;
  updateOfferSnapshot(id: string, updates: Partial<InsertOfferSnapshot>): Promise<OfferSnapshot>;

  // Health Checks
  getHealthCheck(id: string): Promise<HealthCheck | undefined>;
  getHealthChecksByDocument(documentId: string): Promise<HealthCheck[]>;
  getLatestHealthCheckByDocument(documentId: string): Promise<HealthCheck | undefined>;
  getHealthCheckBySnapshot(snapshotId: string): Promise<HealthCheck | undefined>;
  getHealthChecksByUser(userId: string, limit?: number, offset?: number): Promise<HealthCheck[]>;
  createHealthCheck(healthCheck: InsertHealthCheck): Promise<HealthCheck>;
  deleteHealthCheck(id: string): Promise<void>;

  // Navigation Data
  getNavigationData(userId: string): Promise<{
    companies: Array<{
      companyId: string;
      comparisonId: string;
      companyName: string;
      policyTypes: string[];
      hasCombinedView: boolean;
    }>;
    pendingThreads: Array<EmailThread & { companyName: string }>;
    currentInsuranceSnapshotId: string | null;
  }>;

  // Onboarding Progress
  getOnboardingProgressByEmail(email: string): Promise<OnboardingProgress | undefined>;
  createOnboardingProgress(progress: InsertOnboardingProgress): Promise<OnboardingProgress>;
  updateOnboardingProgress(email: string, updates: Partial<InsertOnboardingProgress>): Promise<OnboardingProgress>;

  // Benchmark Prices
  getBenchmarkPrice(policyType: string): Promise<number | null>;
  getAllBenchmarkPrices(): Promise<Array<{ policyType: string; annualPremium: number }>>;
  setBenchmarkPrice(policyType: string, annualPremium: number): Promise<void>;

  // Magic Links
  getMagicLinkByToken(token: string): Promise<MagicLink | undefined>;
  getMagicLinksByComparison(comparisonId: string): Promise<MagicLink[]>;
  createMagicLink(magicLink: InsertMagicLink): Promise<MagicLink>;
  updateMagicLinkConsumed(id: string): Promise<MagicLink>;

  // Notifications
  getNotification(id: string): Promise<Notification | undefined>;
  getNotificationByComparison(comparisonId: string, type: string): Promise<Notification | undefined>;
  getNotificationsByComparison(comparisonId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotificationStatus(id: string, status: string, errorMessage?: string): Promise<Notification>;

  // Company Comparison notified_at
  updateCompanyComparisonNotifiedAt(id: string): Promise<CompanyComparison>;
  
  // Step 5.1: Company Comparison notification status
  updateCompanyComparisonNotificationState(
    id: string, 
    status: "pending" | "sent" | "failed" | "not_required",
    error?: string | null
  ): Promise<CompanyComparison>;

  // Waitlist
  addToWaitlist(email: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private companies: Map<string, Company> = new Map();
  private documents: Map<string, Document> = new Map();
  private emailThreads: Map<string, EmailThread> = new Map();
  private emails: Map<string, Email> = new Map();
  private comparisons: Map<string, Comparison> = new Map();
  private companyComparisons: Map<string, CompanyComparison> = new Map();
  private householdMembers: Map<string, HouseholdMember> = new Map();
  private policies: Map<string, Policy> = new Map();
  private offerSnapshots: Map<string, OfferSnapshot> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private onboardingProgress: Map<string, OnboardingProgress> = new Map();

  constructor() {
    // Initialize with default Danish insurance companies
    this.seedDefaultCompanies();
  }

  private seedDefaultCompanies() {
    const defaultCompanies = [
      {
        id: randomUUID(),
        name: "Alka Forsikring",
        email: "tilbud@alka.dk",
        description: "Specialister i bilforsikring",
        logoUrl: null,
        popular: false,
        active: true
      },
      {
        id: randomUUID(),
        name: "Tryg Forsikring", 
        email: "tilbud@tryg.dk",
        description: "Danmarks største forsikringsselskab",
        logoUrl: null,
        popular: false,
        active: true
      },
      {
        id: randomUUID(),
        name: "Topdanmark",
        email: "tilbud@topdanmark.dk", 
        description: "Konkurrencedygtige priser",
        logoUrl: null,
        popular: false,
        active: true
      },
      {
        id: randomUUID(),
        name: "svphil",
        email: "svphil@gmail.com",
        description: "Personlig forsikringsrådgiver",
        logoUrl: null,
        popular: false,
        active: true
      },
      {
        id: randomUUID(),
        name: "Types Studio",
        email: "hello@typesstudio.com",
        description: "Moderne forsikringsløsninger",
        logoUrl: null,
        popular: false,
        active: true
      }
    ];

    defaultCompanies.forEach(company => {
      this.companies.set(company.id, company);
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      id,
      email: insertUser.email,
      passwordHash: insertUser.passwordHash ?? null,
      name: insertUser.name ?? null,
      phone: insertUser.phone ?? null,
      dateOfBirth: insertUser.dateOfBirth ?? null,
      address: insertUser.address ?? null,
      personalIdNumber: insertUser.personalIdNumber ?? null,
      housingType: insertUser.housingType ?? null,
      hasCar: insertUser.hasCar ?? null,
      deductible: insertUser.deductible ?? null,
      age: insertUser.age ?? null,
      additionalInfo: insertUser.additionalInfo ?? null,
      insuranceTypes: insertUser.insuranceTypes ?? null,
      priorityOne: insertUser.priorityOne ?? null,
      priorityTwo: insertUser.priorityTwo ?? null,
      priorityThree: insertUser.priorityThree ?? null,
      insurancePriority: insertUser.insurancePriority ?? null,
      aiAutoResponseEnabled: insertUser.aiAutoResponseEnabled ?? null,
      createdAt: new Date() 
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const existing = this.users.get(id);
    if (!existing) throw new Error("User not found");
    
    const updated: User = { ...existing, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  // Companies
  async getCompany(id: string): Promise<Company | undefined> {
    return this.companies.get(id);
  }

  async getActiveCompanies(): Promise<Company[]> {
    return Array.from(this.companies.values()).filter(c => c.active);
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const id = randomUUID();
    const company: Company = { 
      id,
      name: insertCompany.name,
      email: insertCompany.email,
      description: insertCompany.description ?? null,
      logoUrl: insertCompany.logoUrl ?? null,
      popular: insertCompany.popular ?? null,
      active: insertCompany.active ?? null
    };
    this.companies.set(id, company);
    return company;
  }

  // Documents
  async getDocument(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async getDocumentByFileHash(userId: string, fileHash: string): Promise<Document | undefined> {
    return Array.from(this.documents.values()).find(
      d => d.userId === userId && d.fileHash === fileHash
    );
  }

  async getOfferDocumentByUserCompanyAndHash(userId: string, companyId: string, fileHash: string): Promise<Document | undefined> {
    return Array.from(this.documents.values()).find(
      d => d.userId === userId && d.companyId === companyId && d.fileHash === fileHash && d.documentType === 'offer'
    );
  }

  async getUserDocuments(userId: string, documentType?: string, limit?: number, offset?: number): Promise<Document[]> {
    const filtered = Array.from(this.documents.values()).filter(doc => 
      doc.userId === userId && 
      (documentType ? doc.documentType === documentType : true)
    );
    
    // Apply pagination if provided
    if (limit !== undefined && offset !== undefined) {
      return filtered.slice(offset, offset + limit);
    }
    
    return filtered;
  }

  async countUserDocuments(userId: string, documentType?: string): Promise<number> {
    return Array.from(this.documents.values()).filter(doc => 
      doc.userId === userId && 
      (documentType ? doc.documentType === documentType : true)
    ).length;
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const document: Document = { 
      id,
      userId: insertDocument.userId ?? null,
      fileName: insertDocument.fileName,
      filePath: insertDocument.filePath,
      fileSize: insertDocument.fileSize ?? null,
      fileHash: insertDocument.fileHash ?? null,
      ocrData: insertDocument.ocrData ?? null,
      ocrRawResponse: insertDocument.ocrRawResponse ?? null,
      extractionStatus: insertDocument.extractionStatus ?? null,
      totalPoliciesExtracted: insertDocument.totalPoliciesExtracted ?? null,
      documentType: insertDocument.documentType ?? null,
      companyId: insertDocument.companyId ?? null,
      extractionStages: null, // Will be populated by extraction pipeline
      createdAt: new Date() 
    };
    this.documents.set(id, document);
    return document;
  }

  async updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document> {
    const existing = this.documents.get(id);
    if (!existing) throw new Error("Document not found");
    
    const updated: Document = { ...existing, ...updates };
    this.documents.set(id, updated);
    return updated;
  }

  async updateDocumentExtractionStages(id: string, stagesData: any): Promise<void> {
    const existing = this.documents.get(id);
    if (!existing) throw new Error("Document not found");
    // Update in place (extractionStages is part of Document type)
    const updated: Document = { ...existing, extractionStages: stagesData };
    this.documents.set(id, updated);
  }

  async deleteDocument(id: string): Promise<void> {
    this.documents.delete(id);
  }

  // Email Threads
  async getEmailThread(id: string): Promise<EmailThread | undefined> {
    return this.emailThreads.get(id);
  }

  async getEmailThreadByGmailId(gmailThreadId: string): Promise<EmailThread | undefined> {
    return Array.from(this.emailThreads.values()).find(t => t.threadId === gmailThreadId);
  }

  async getEmailThreadByToken(token: string): Promise<EmailThread | undefined> {
    return Array.from(this.emailThreads.values()).find(t => t.requestToken === token);
  }

  async getEmailThreadByCompany(userId: string, companyId: string): Promise<EmailThread | undefined> {
    return Array.from(this.emailThreads.values()).find(t => t.userId === userId && t.companyId === companyId);
  }

  async getUserEmailThreads(userId: string): Promise<EmailThread[]> {
    return Array.from(this.emailThreads.values()).filter(t => t.userId === userId);
  }

  async getUserEmailThreadsEnriched(userId: string, limit?: number, offset?: number): Promise<Array<EmailThread & { company: Company | null; emailCount: number; lastEmailAt: Date | null }>> {
    const threads = Array.from(this.emailThreads.values()).filter(t => t.userId === userId);
    const paginatedThreads = limit && offset !== undefined ? threads.slice(offset, offset + limit) : threads;
    
    return paginatedThreads.map(thread => {
      const company = thread.companyId ? this.companies.get(thread.companyId) || null : null;
      const emails = Array.from(this.emails.values()).filter(e => e.threadId === thread.id);
      const sortedEmails = emails.sort((a, b) => (a.sentAt?.getTime() || 0) - (b.sentAt?.getTime() || 0));
      
      return {
        ...thread,
        company,
        emailCount: emails.length,
        lastEmailAt: sortedEmails.length > 0 ? sortedEmails[sortedEmails.length - 1].sentAt : null
      };
    });
  }

  async createEmailThread(insertThread: InsertEmailThread): Promise<EmailThread> {
    const id = randomUUID();
    const thread: EmailThread = { 
      id,
      userId: insertThread.userId ?? null,
      companyId: insertThread.companyId ?? null,
      subject: insertThread.subject ?? null,
      threadId: insertThread.threadId ?? null,
      requestToken: insertThread.requestToken ?? null,
      replyToEmail: insertThread.replyToEmail ?? null,
      status: insertThread.status ?? null,
      createdAt: new Date(),
      aiMode: insertThread.aiMode ?? 'manual'
    };
    this.emailThreads.set(id, thread);
    return thread;
  }

  async updateEmailThread(id: string, updates: Partial<InsertEmailThread>): Promise<EmailThread> {
    const existing = this.emailThreads.get(id);
    if (!existing) throw new Error("Email thread not found");
    
    const updated: EmailThread = { ...existing, ...updates };
    this.emailThreads.set(id, updated);
    return updated;
  }

  // Emails
  async getEmail(id: string): Promise<Email | undefined> {
    return this.emails.get(id);
  }

  async getEmailById(id: string): Promise<Email | undefined> {
    return this.emails.get(id);
  }

  async getEmailWithThread(id: string): Promise<{ email: Email; thread: EmailThread } | undefined> {
    const email = this.emails.get(id);
    if (!email || !email.threadId) return undefined;
    const thread = this.emailThreads.get(email.threadId);
    if (!thread) return undefined;
    return { email, thread };
  }

  async getThreadEmails(threadId: string, direction?: string): Promise<Email[]> {
    return Array.from(this.emails.values()).filter(email => 
      email.threadId === threadId &&
      (direction ? email.direction === direction : true)
    ).sort((a, b) => (a.sentAt?.getTime() || 0) - (b.sentAt?.getTime() || 0));
  }

  async createEmail(insertEmail: InsertEmail): Promise<Email> {
    const id = randomUUID();
    const email: Email = { 
      id,
      threadId: insertEmail.threadId ?? null,
      messageId: insertEmail.messageId ?? null,
      emailMessageId: insertEmail.emailMessageId ?? null,
      direction: insertEmail.direction ?? null,
      subject: insertEmail.subject ?? null,
      body: insertEmail.body ?? null,
      attachments: insertEmail.attachments ?? null,
      metadata: insertEmail.metadata ?? null,
      sentAt: insertEmail.sentAt ?? null,
      createdAt: new Date(),
      status: insertEmail.status ?? 'sent',
      authorType: insertEmail.authorType ?? 'system',
      classifierLabel: insertEmail.classifierLabel ?? null,
      debugMeta: insertEmail.debugMeta ?? null,
    };
    this.emails.set(id, email);
    return email;
  }

  async updateEmail(id: string, updates: Partial<InsertEmail>): Promise<Email> {
    const email = this.emails.get(id);
    if (!email) throw new Error("Email not found");
    const updated = { ...email, ...updates } as Email;
    this.emails.set(id, updated);
    return updated;
  }

  async getThreadDraftEmails(threadId: string): Promise<Email[]> {
    return Array.from(this.emails.values()).filter(
      email => email.threadId === threadId && email.status === 'draft'
    );
  }

  async getDraftEmailsByUser(userId: string): Promise<Array<Email & { thread: EmailThread; company: Company | null }>> {
    const drafts = Array.from(this.emails.values()).filter(e => e.status === 'draft');
    return drafts.map(email => {
      const thread = this.emailThreads.get(email.threadId || '');
      const company = thread?.companyId ? this.companies.get(thread.companyId) : null;
      return {
        ...email,
        thread: thread!,
        company: company || null
      };
    }).filter(d => d.thread?.userId === userId);
  }

  async getAllDraftEmails(): Promise<Array<Email & { thread: EmailThread; company: Company | null; user: User | null }>> {
    const drafts = Array.from(this.emails.values()).filter(e => e.status === 'draft');
    return drafts.map(email => {
      const thread = this.emailThreads.get(email.threadId || '');
      const company = thread?.companyId ? this.companies.get(thread.companyId) : null;
      const user = thread?.userId ? this.users.get(thread.userId) : null;
      return {
        ...email,
        thread: thread!,
        company: company || null,
        user: user || null
      };
    }).filter(d => d.thread);
  }

  private aiDebugReports = new Map<string, AiDebugReport>();

  async createAiDebugReport(report: InsertAiDebugReport): Promise<AiDebugReport> {
    const id = randomUUID();
    const created: AiDebugReport = {
      id,
      threadId: report.threadId,
      companyMessageId: report.companyMessageId ?? null,
      aiMessageId: report.aiMessageId ?? null,
      finalSentBody: report.finalSentBody ?? null,
      classifierOutput: report.classifierOutput ?? null,
      replyPromptVersion: report.replyPromptVersion ?? null,
      analysis: report.analysis ?? null,
      createdAt: new Date()
    };
    this.aiDebugReports.set(id, created);
    return created;
  }

  async getAiDebugReports(threadId?: string, limit = 50): Promise<AiDebugReport[]> {
    let reports = Array.from(this.aiDebugReports.values());
    if (threadId) {
      reports = reports.filter(r => r.threadId === threadId);
    }
    return reports.slice(0, limit);
  }

  async getAiDebugReportByMessageId(aiMessageId: string): Promise<AiDebugReport | undefined> {
    return Array.from(this.aiDebugReports.values()).find(r => r.aiMessageId === aiMessageId);
  }

  // Comparisons
  async getComparison(id: string): Promise<Comparison | undefined> {
    return this.comparisons.get(id);
  }

  async getUserComparisons(userId: string): Promise<Comparison[]> {
    return Array.from(this.comparisons.values()).filter(c => c.userId === userId);
  }

  async getComparisonByUserAndCompany(userId: string, companyId: string): Promise<Comparison | undefined> {
    return Array.from(this.comparisons.values()).find(c => c.userId === userId && c.companyId === companyId);
  }

  async getComparisonsByUserAndCompany(userId: string, companyId: string): Promise<Comparison[]> {
    return Array.from(this.comparisons.values()).filter(c => c.userId === userId && c.companyId === companyId);
  }

  async getComparisonsByOfferDocument(offerDocumentId: string): Promise<Comparison[]> {
    return Array.from(this.comparisons.values()).filter(c => c.offerDocumentId === offerDocumentId);
  }

  async createComparison(insertComparison: InsertComparison): Promise<Comparison> {
    const id = randomUUID();
    const comparison: Comparison = { 
      id,
      userId: insertComparison.userId ?? null,
      currentDocumentId: insertComparison.currentDocumentId ?? null,
      offerDocumentId: insertComparison.offerDocumentId ?? null,
      companyId: insertComparison.companyId ?? null,
      policyType: insertComparison.policyType ?? null,
      currentPolicyId: insertComparison.currentPolicyId ?? null,
      offerPolicyId: insertComparison.offerPolicyId ?? null,
      comparisonData: insertComparison.comparisonData ?? null,
      aiRecommendation: insertComparison.aiRecommendation ?? null,
      savings: insertComparison.savings ?? null,
      createdAt: new Date() 
    };
    this.comparisons.set(id, comparison);
    return comparison;
  }

  // Company Comparisons (Phase 4)
  async getCompanyComparison(id: string): Promise<CompanyComparison | undefined> {
    return this.companyComparisons.get(id);
  }

  async getCompanyComparisonsByUser(userId: string): Promise<CompanyComparison[]> {
    return Array.from(this.companyComparisons.values()).filter(c => c.userId === userId);
  }

  async getActiveCompanyComparisonsByUser(userId: string): Promise<CompanyComparison[]> {
    return Array.from(this.companyComparisons.values())
      .filter(c => c.userId === userId && !(c as any).isSuperseded);
  }

  async supersedeCompanyComparisons(userId: string, currentCompany: string, offerCompany: string): Promise<number> {
    let count = 0;
    for (const [id, comparison] of this.companyComparisons.entries()) {
      if (comparison.userId === userId && 
          comparison.currentCompany === currentCompany && 
          comparison.offerCompany === offerCompany &&
          !(comparison as any).isSuperseded) {
        (comparison as any).isSuperseded = true;
        (comparison as any).updatedAt = new Date();
        count++;
      }
    }
    return count;
  }

  async getCompanyComparisonByCompanies(
    userId: string,
    currentCompany: string,
    offerCompany: string
  ): Promise<CompanyComparison | undefined> {
    return Array.from(this.companyComparisons.values())
      .filter(c => c.userId === userId && c.currentCompany === currentCompany && c.offerCompany === offerCompany)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))[0];
  }

  async createCompanyComparison(insertComparison: InsertCompanyComparison): Promise<CompanyComparison> {
    const id = randomUUID();
    const comparison: CompanyComparison = {
      id,
      userId: insertComparison.userId,
      currentCompany: insertComparison.currentCompany,
      offerCompany: insertComparison.offerCompany,
      status: insertComparison.status ?? 'pending',
      statusReason: insertComparison.statusReason ?? null,
      comparisonJSON: insertComparison.comparisonJSON ?? null,
      errorMessage: insertComparison.errorMessage ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.companyComparisons.set(id, comparison);
    return comparison;
  }

  async updateCompanyComparisonStatus(
    id: string,
    status: string,
    comparisonJSON?: any,
    errorMessage?: string,
    statusReason?: string
  ): Promise<CompanyComparison> {
    const comparison = await this.getCompanyComparison(id);
    if (!comparison) throw new Error('Company comparison not found');
    
    const updated: CompanyComparison = {
      ...comparison,
      status,
      updatedAt: new Date()
    };
    
    if (comparisonJSON !== undefined) {
      updated.comparisonJSON = comparisonJSON;
    }
    if (errorMessage !== undefined) {
      updated.errorMessage = errorMessage;
    }
    if (statusReason !== undefined) {
      updated.statusReason = statusReason;
    }
    
    this.companyComparisons.set(id, updated);
    return updated;
  }

  // Household Members
  async getHouseholdMember(id: string): Promise<HouseholdMember | undefined> {
    return this.householdMembers.get(id);
  }

  async getUserHouseholdMembers(userId: string): Promise<HouseholdMember[]> {
    return Array.from(this.householdMembers.values()).filter(m => m.userId === userId);
  }

  async createHouseholdMember(insertMember: InsertHouseholdMember): Promise<HouseholdMember> {
    const id = randomUUID();
    const member: HouseholdMember = {
      id,
      userId: insertMember.userId,
      name: insertMember.name,
      relationship: insertMember.relationship ?? null,
      dateOfBirth: insertMember.dateOfBirth ?? null,
      avatarUrl: insertMember.avatarUrl ?? null,
      createdAt: new Date()
    };
    this.householdMembers.set(id, member);
    return member;
  }

  async updateHouseholdMember(id: string, updates: Partial<InsertHouseholdMember>): Promise<HouseholdMember> {
    const member = await this.getHouseholdMember(id);
    if (!member) throw new Error('Household member not found');
    const updated = { ...member, ...updates };
    this.householdMembers.set(id, updated);
    return updated;
  }

  async deleteHouseholdMember(id: string): Promise<void> {
    this.householdMembers.delete(id);
  }

  // Comparison Current Snapshots (Step 5.3)
  private comparisonCurrentSnapshots: Map<string, ComparisonCurrentSnapshot> = new Map();

  async getComparisonCurrentSnapshots(comparisonId: string): Promise<ComparisonCurrentSnapshot[]> {
    return Array.from(this.comparisonCurrentSnapshots.values()).filter(s => s.comparisonId === comparisonId);
  }

  async createComparisonCurrentSnapshot(snapshot: InsertComparisonCurrentSnapshot): Promise<ComparisonCurrentSnapshot> {
    const id = randomUUID();
    const newSnapshot: ComparisonCurrentSnapshot = {
      id,
      comparisonId: snapshot.comparisonId,
      policySnapshotId: snapshot.policySnapshotId,
      policyType: snapshot.policyType,
      companyName: snapshot.companyName,
      createdAt: new Date()
    };
    this.comparisonCurrentSnapshots.set(id, newSnapshot);
    return newSnapshot;
  }

  async freezeCurrentSnapshotsForComparison(comparisonId: string, userId: string): Promise<ComparisonCurrentSnapshot[]> {
    const currentSnapshots = Array.from(this.policySnapshots.values()).filter(
      s => s.userId === userId && s.kind === 'current' && s.isActive && s.status === 'active'
    );
    const frozenSnapshots: ComparisonCurrentSnapshot[] = [];
    for (const snapshot of currentSnapshots) {
      const frozen = await this.createComparisonCurrentSnapshot({
        comparisonId,
        policySnapshotId: snapshot.id,
        policyType: snapshot.policyType,
        companyName: snapshot.companyName
      });
      frozenSnapshots.push(frozen);
    }
    return frozenSnapshots;
  }

  // Policies
  async getPolicy(id: string): Promise<Policy | undefined> {
    return this.policies.get(id);
  }

  async getPoliciesByUser(userId: string): Promise<Policy[]> {
    return Array.from(this.policies.values()).filter(p => p.userId === userId);
  }

  async getPoliciesByTypeAndUser(userId: string, policyType: string, isOwnPolicy?: boolean): Promise<Policy[]> {
    let policies = Array.from(this.policies.values()).filter(
      p => p.userId === userId && p.policyType === policyType
    );
    if (isOwnPolicy !== undefined) {
      policies = policies.filter(p => p.isOwnPolicy === isOwnPolicy);
    }
    return policies;
  }

  async getPoliciesByDocument(documentId: string): Promise<Policy[]> {
    return Array.from(this.policies.values()).filter(p => p.documentId === documentId);
  }

  async createPolicy(insertPolicy: InsertPolicy): Promise<Policy> {
    const id = randomUUID();
    const policy: Policy = {
      id,
      documentId: insertPolicy.documentId,
      userId: insertPolicy.userId,
      companyId: insertPolicy.companyId ?? null,
      policyType: insertPolicy.policyType,
      isOwnPolicy: insertPolicy.isOwnPolicy ?? true,
      premium: insertPolicy.premium ?? null,
      deductible: insertPolicy.deductible ?? null,
      coverageDetails: insertPolicy.coverageDetails ?? null,
      sourcePageRange: insertPolicy.sourcePageRange ?? null,
      extractionConfidence: insertPolicy.extractionConfidence ?? null,
      healthCheckStatus: insertPolicy.healthCheckStatus ?? "pending",
      healthCheckPayload: insertPolicy.healthCheckPayload ?? null,
      healthCheckSavingsAnnual: insertPolicy.healthCheckSavingsAnnual ?? null,
      healthCheckUpdatedAt: insertPolicy.healthCheckUpdatedAt ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.policies.set(id, policy);
    return policy;
  }

  async updatePolicy(id: string, updates: Partial<InsertPolicy>): Promise<Policy> {
    const existing = this.policies.get(id);
    if (!existing) throw new Error("Policy not found");
    
    const updated: Policy = { ...existing, ...updates, updatedAt: new Date() };
    this.policies.set(id, updated);
    return updated;
  }

  async updatePolicyHealthCheck(id: string, healthCheckData: {
    status: string;
    payload: any;
    savingsAnnual: number;
  }): Promise<Policy> {
    const existing = this.policies.get(id);
    if (!existing) throw new Error("Policy not found");
    
    const updated: Policy = {
      ...existing,
      healthCheckStatus: healthCheckData.status,
      healthCheckPayload: healthCheckData.payload,
      healthCheckSavingsAnnual: healthCheckData.savingsAnnual.toString() as any,
      healthCheckUpdatedAt: new Date(),
      updatedAt: new Date(),
    };
    this.policies.set(id, updated);
    return updated;
  }

  async deletePolicy(id: string): Promise<void> {
    this.policies.delete(id);
  }

  async detectDuplicatePolicies(
    userId: string,
    policyType: string,
    companyId: string | null,
    premium: number | null
  ): Promise<Policy[]> {
    const policies = Array.from(this.policies.values()).filter(p => {
      if (p.userId !== userId || p.policyType !== policyType) return false;
      if (companyId && p.companyId !== companyId) return false;
      if (premium && p.premium && Math.abs(Number(p.premium) - premium) > 100) return false; // Allow 100 DKK difference
      return true;
    });
    return policies;
  }

  // Offer Snapshots
  async getOfferSnapshot(id: string): Promise<OfferSnapshot | undefined> {
    return this.offerSnapshots.get(id);
  }

  async getOfferSnapshotsByDocument(documentId: string): Promise<OfferSnapshot[]> {
    return Array.from(this.offerSnapshots.values()).filter(s => s.documentId === documentId);
  }

  async getOfferSnapshotsByUser(userId: string, validationStatus?: string): Promise<OfferSnapshot[]> {
    return Array.from(this.offerSnapshots.values()).filter(s => 
      s.userId === userId && 
      (validationStatus ? s.validationStatus === validationStatus : true)
    );
  }

  async getOfferSnapshotByPolicy(policyId: string): Promise<OfferSnapshot | undefined> {
    return Array.from(this.offerSnapshots.values()).find(s => s.policyId === policyId);
  }

  async createOfferSnapshot(insertSnapshot: InsertOfferSnapshot): Promise<OfferSnapshot> {
    const id = randomUUID();
    const snapshot: OfferSnapshot = {
      id,
      documentId: insertSnapshot.documentId,
      userId: insertSnapshot.userId,
      policyId: insertSnapshot.policyId ?? null,
      policyType: insertSnapshot.policyType,
      companyId: insertSnapshot.companyId ?? null,
      premium: insertSnapshot.premium ?? null,
      deductible: insertSnapshot.deductible ?? null,
      coverageDetails: insertSnapshot.coverageDetails,
      extractionVersion: insertSnapshot.extractionVersion,
      extractorModel: insertSnapshot.extractorModel,
      extractorProvider: insertSnapshot.extractorProvider,
      confidenceScore: insertSnapshot.confidenceScore ?? null,
      validationStatus: insertSnapshot.validationStatus ?? "pending",
      validationErrors: insertSnapshot.validationErrors ?? null,
      sourcePageRange: insertSnapshot.sourcePageRange ?? null,
      rawExtractedData: insertSnapshot.rawExtractedData ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.offerSnapshots.set(id, snapshot);
    return snapshot;
  }

  async updateOfferSnapshot(id: string, updates: Partial<InsertOfferSnapshot>): Promise<OfferSnapshot> {
    const existing = this.offerSnapshots.get(id);
    if (!existing) throw new Error("OfferSnapshot not found");
    
    const updated: OfferSnapshot = { ...existing, ...updates, updatedAt: new Date() };
    this.offerSnapshots.set(id, updated);
    return updated;
  }

  // Health Checks
  async getHealthCheck(id: string): Promise<HealthCheck | undefined> {
    return this.healthChecks.get(id);
  }

  async getHealthChecksByDocument(documentId: string): Promise<HealthCheck[]> {
    return Array.from(this.healthChecks.values())
      .filter(hc => hc.documentId === documentId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getLatestHealthCheckByDocument(documentId: string): Promise<HealthCheck | undefined> {
    const healthChecks = await this.getHealthChecksByDocument(documentId);
    return healthChecks[0];
  }

  async getHealthCheckBySnapshot(snapshotId: string): Promise<HealthCheck | undefined> {
    return Array.from(this.healthChecks.values())
      .filter(hc => hc.snapshotId === snapshotId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))[0];
  }

  async getHealthChecksByUser(userId: string, limit = 50, offset = 0): Promise<HealthCheck[]> {
    const userHealthChecks = Array.from(this.healthChecks.values())
      .filter(hc => hc.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    return userHealthChecks.slice(offset, offset + limit);
  }

  async createHealthCheck(insertHealthCheck: InsertHealthCheck): Promise<HealthCheck> {
    const id = randomUUID();
    const healthCheck: HealthCheck = {
      id,
      documentId: insertHealthCheck.documentId,
      userId: insertHealthCheck.userId,
      dataSource: insertHealthCheck.dataSource,
      confidenceScore: insertHealthCheck.confidenceScore ?? null,
      result: insertHealthCheck.result,
      createdAt: new Date(),
    };
    this.healthChecks.set(id, healthCheck);
    return healthCheck;
  }

  async deleteHealthCheck(id: string): Promise<void> {
    this.healthChecks.delete(id);
  }

  async getNavigationData(userId: string): Promise<{
    companies: Array<{
      companyId: string;
      comparisonId: string;
      companyName: string;
      policyTypes: string[];
      hasCombinedView: boolean;
    }>;
    pendingThreads: Array<EmailThread & { companyName: string }>;
    currentInsuranceSnapshotId: string | null;
  }> {
    const userComparisons = Array.from(this.comparisons.values())
      .filter(c => c.userId === userId);
    
    const companyMap = new Map<string, { policyTypes: Set<string>; comparisonId: string }>();
    
    for (const comparison of userComparisons) {
      const companyId = comparison.companyId || '';
      if (!companyMap.has(companyId)) {
        companyMap.set(companyId, { policyTypes: new Set(), comparisonId: comparison.id });
      }
      if (comparison.policyType) {
        companyMap.get(companyId)!.policyTypes.add(comparison.policyType);
      }
    }
    
    const companies = Array.from(companyMap.entries()).map(([companyId, data]) => {
      const company = this.companies.get(companyId);
      const policyTypes = Array.from(data.policyTypes);
      return {
        companyId,
        comparisonId: data.comparisonId,
        companyName: company?.name || 'Unknown Company',
        policyTypes,
        hasCombinedView: policyTypes.length > 1
      };
    });

    const userThreads = Array.from(this.emailThreads.values())
      .filter(t => t.userId === userId && (t.status === 'sent' || t.status === 'pending'));
    
    const threadsWithCompany = userThreads.map(thread => {
      const company = this.companies.get(thread.companyId || '');
      return {
        ...thread,
        companyName: company?.name || 'Unknown Company'
      };
    });

    return {
      companies,
      pendingThreads: threadsWithCompany,
      currentInsuranceSnapshotId: null
    };
  }

  // Onboarding Progress
  async getOnboardingProgressByEmail(email: string): Promise<OnboardingProgress | undefined> {
    return Array.from(this.onboardingProgress.values()).find(p => p.email === email);
  }

  async createOnboardingProgress(insertProgress: InsertOnboardingProgress): Promise<OnboardingProgress> {
    const id = randomUUID();
    const progress: OnboardingProgress = {
      id,
      email: insertProgress.email,
      userId: insertProgress.userId ?? null,
      currentStep: insertProgress.currentStep ?? 1,
      completedSteps: insertProgress.completedSteps ?? [],
      selectedCompanyIds: insertProgress.selectedCompanyIds ?? [],
      documentId: insertProgress.documentId ?? null,
      name: insertProgress.name ?? null,
      cpr: insertProgress.cpr ?? null,
      priority: insertProgress.priority ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.onboardingProgress.set(insertProgress.email, progress);
    return progress;
  }

  async updateOnboardingProgress(email: string, updates: Partial<InsertOnboardingProgress>): Promise<OnboardingProgress> {
    const progress = await this.getOnboardingProgressByEmail(email);
    if (!progress) {
      throw new Error('Onboarding progress not found');
    }
    const updated = {
      ...progress,
      ...updates,
      updatedAt: new Date()
    };
    this.onboardingProgress.set(email, updated);
    return updated;
  }

  // Benchmark Prices (MemStorage - hardcoded defaults)
  private benchmarkPrices: Map<string, number> = new Map([
    ["indbo", 2000],
    ["hus", 4500],
    ["ulykke", 1500],
    ["bil", 3000],
    ["rejse", 800],
  ]);

  async getBenchmarkPrice(policyType: string): Promise<number | null> {
    return this.benchmarkPrices.get(policyType) ?? null;
  }

  async getAllBenchmarkPrices(): Promise<Array<{ policyType: string; annualPremium: number }>> {
    return Array.from(this.benchmarkPrices.entries()).map(([policyType, annualPremium]) => ({
      policyType,
      annualPremium,
    }));
  }

  async setBenchmarkPrice(policyType: string, annualPremium: number): Promise<void> {
    this.benchmarkPrices.set(policyType, annualPremium);
  }

  // Waitlist (MemStorage - stores in memory, not persistent)
  private waitlistEmails: Set<string> = new Set();
  
  async addToWaitlist(email: string): Promise<void> {
    if (this.waitlistEmails.has(email)) {
      throw new Error('duplicate key value');
    }
    this.waitlistEmails.add(email);
  }
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    return await withCache(`user:${id}`, 60, async () => {
      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user || undefined;
    });
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const { db } = await import("./db");
    const { users } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const { db } = await import("./db");
    const { users } = await import("@shared/schema");
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const { db } = await import("./db");
    const { users } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    
    apiCache.invalidate(`user:${id}`);
    
    return user;
  }

  // Companies
  async getCompany(id: string): Promise<Company | undefined> {
    const { db } = await import("./db");
    const { companies } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async getActiveCompanies(): Promise<Company[]> {
    return await withCache('active-companies', 300, async () => {
      const { db } = await import("./db");
      const { companies } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      return await db.select().from(companies).where(eq(companies.active, true));
    });
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const { db } = await import("./db");
    const { companies } = await import("@shared/schema");
    const [company] = await db.insert(companies).values(insertCompany).returning();
    return company;
  }

  // Documents
  async getDocument(id: string): Promise<Document | undefined> {
    const { db } = await import("./db");
    const { documents } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc || undefined;
  }

  async getDocumentByFileHash(userId: string, fileHash: string): Promise<Document | undefined> {
    const { db } = await import("./db");
    const { documents } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    const [doc] = await db.select().from(documents).where(
      and(eq(documents.userId, userId), eq(documents.fileHash, fileHash))
    );
    return doc || undefined;
  }

  async getOfferDocumentByUserCompanyAndHash(userId: string, companyId: string, fileHash: string): Promise<Document | undefined> {
    const { db } = await import("./db");
    const { documents } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    const [doc] = await db.select().from(documents).where(
      and(
        eq(documents.userId, userId),
        eq(documents.companyId, companyId),
        eq(documents.fileHash, fileHash),
        eq(documents.documentType, 'offer')
      )
    );
    return doc || undefined;
  }

  async getUserDocuments(userId: string, documentType?: string, limit?: number, offset?: number): Promise<Document[]> {
    const { db } = await import("./db");
    const { documents } = await import("@shared/schema");
    const { eq, and, desc } = await import("drizzle-orm");
    
    let query = db.select().from(documents);
    
    if (documentType) {
      query = query.where(and(eq(documents.userId, userId), eq(documents.documentType, documentType))) as any;
    } else {
      query = query.where(eq(documents.userId, userId)) as any;
    }
    
    // Always order by creation date for consistent pagination
    query = query.orderBy(desc(documents.createdAt)) as any;
    
    // Apply pagination
    if (limit !== undefined) {
      query = query.limit(limit) as any;
    }
    if (offset !== undefined) {
      query = query.offset(offset) as any;
    }
    
    return await query;
  }

  async countUserDocuments(userId: string, documentType?: string): Promise<number> {
    const { db } = await import("./db");
    const { documents } = await import("@shared/schema");
    const { eq, and, count } = await import("drizzle-orm");
    
    let query = db.select({ count: count() }).from(documents);
    
    if (documentType) {
      query = query.where(and(eq(documents.userId, userId), eq(documents.documentType, documentType))) as any;
    } else {
      query = query.where(eq(documents.userId, userId)) as any;
    }
    
    const result = await query;
    return result[0]?.count || 0;
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const { db } = await import("./db");
    const { documents } = await import("@shared/schema");
    const [doc] = await db.insert(documents).values(insertDocument).returning();
    return doc;
  }

  async updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document> {
    const { db } = await import("./db");
    const { documents } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [doc] = await db.update(documents).set(updates).where(eq(documents.id, id)).returning();
    if (!doc) throw new Error("Document not found");
    apiCache.invalidate(`/api/documents/`);
    return doc;
  }

  async updateDocumentExtractionStages(id: string, stagesData: any): Promise<void> {
    const { db } = await import("./db");
    const { documents } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    await db.update(documents).set({ extractionStages: stagesData }).where(eq(documents.id, id));
    // Don't invalidate cache - this is debug data
  }

  async deleteDocument(id: string): Promise<void> {
    const { db } = await import("./db");
    const { documents } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    await db.delete(documents).where(eq(documents.id, id));
    apiCache.invalidate(`/api/documents/`);
  }

  // Email Threads
  async getEmailThread(id: string): Promise<EmailThread | undefined> {
    const { db } = await import("./db");
    const { emailThreads } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [thread] = await db.select().from(emailThreads).where(eq(emailThreads.id, id));
    return thread || undefined;
  }

  async getEmailThreadByGmailId(gmailThreadId: string): Promise<EmailThread | undefined> {
    const { db } = await import("./db");
    const { emailThreads } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [thread] = await db.select().from(emailThreads).where(eq(emailThreads.threadId, gmailThreadId));
    return thread || undefined;
  }

  async getEmailThreadByToken(token: string): Promise<EmailThread | undefined> {
    const { db } = await import("./db");
    const { emailThreads } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [thread] = await db.select().from(emailThreads).where(eq(emailThreads.requestToken, token));
    return thread || undefined;
  }

  async getEmailThreadByCompany(userId: string, companyId: string): Promise<EmailThread | undefined> {
    const { db } = await import("./db");
    const { emailThreads } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    const [thread] = await db.select().from(emailThreads).where(
      and(eq(emailThreads.userId, userId), eq(emailThreads.companyId, companyId))
    );
    return thread || undefined;
  }

  async getUserEmailThreads(userId: string): Promise<EmailThread[]> {
    const { db } = await import("./db");
    const { emailThreads } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    return await db.select().from(emailThreads).where(eq(emailThreads.userId, userId));
  }

  async getUserEmailThreadsEnriched(userId: string, limit?: number, offset?: number): Promise<Array<EmailThread & { company: Company | null; emailCount: number; lastEmailAt: Date | null }>> {
    const { db } = await import("./db");
    const { emailThreads, companies, emails } = await import("@shared/schema");
    const { eq, desc, count, max, sql } = await import("drizzle-orm");
    
    // Use LEFT JOIN to get threads with company data and email counts in ONE query
    // This eliminates the N+1 problem completely
    const results = await db
      .select({
        id: emailThreads.id,
        userId: emailThreads.userId,
        companyId: emailThreads.companyId,
        subject: emailThreads.subject,
        threadId: emailThreads.threadId,
        requestToken: emailThreads.requestToken,
        replyToEmail: emailThreads.replyToEmail,
        status: emailThreads.status,
        createdAt: emailThreads.createdAt,
        company: companies,
        emailCount: sql<number>`COALESCE(COUNT(${emails.id}), 0)`.as('emailCount'),
        lastEmailAt: sql<Date>`MAX(${emails.sentAt})`.as('lastEmailAt')
      })
      .from(emailThreads)
      .leftJoin(companies, eq(emailThreads.companyId, companies.id))
      .leftJoin(emails, eq(emailThreads.id, emails.threadId))
      .where(eq(emailThreads.userId, userId))
      .groupBy(emailThreads.id, companies.id)
      .orderBy(desc(emailThreads.createdAt))
      .limit(limit || 50)
      .offset(offset || 0);
    
    return results.map(row => ({
      id: row.id,
      userId: row.userId,
      companyId: row.companyId,
      subject: row.subject,
      threadId: row.threadId,
      requestToken: row.requestToken,
      replyToEmail: row.replyToEmail,
      status: row.status,
      createdAt: row.createdAt,
      company: row.company,
      emailCount: Number(row.emailCount),
      lastEmailAt: row.lastEmailAt
    }));
  }

  async getAllEmailThreadsEnriched(limit?: number, offset?: number): Promise<Array<EmailThread & { company: Company | null; user: User | null; emailCount: number; lastEmailAt: Date | null }>> {
    const { db } = await import("./db");
    const { emailThreads, companies, emails, users } = await import("@shared/schema");
    const { desc, sql, eq } = await import("drizzle-orm");
    
    const results = await db
      .select({
        id: emailThreads.id,
        userId: emailThreads.userId,
        companyId: emailThreads.companyId,
        subject: emailThreads.subject,
        threadId: emailThreads.threadId,
        requestToken: emailThreads.requestToken,
        replyToEmail: emailThreads.replyToEmail,
        status: emailThreads.status,
        createdAt: emailThreads.createdAt,
        aiMode: emailThreads.aiMode,
        company: companies,
        user: users,
        emailCount: sql<number>`COALESCE(COUNT(${emails.id}), 0)`.as('emailCount'),
        lastEmailAt: sql<Date>`MAX(${emails.sentAt})`.as('lastEmailAt')
      })
      .from(emailThreads)
      .leftJoin(companies, eq(emailThreads.companyId, companies.id))
      .leftJoin(users, eq(emailThreads.userId, users.id))
      .leftJoin(emails, eq(emailThreads.id, emails.threadId))
      .groupBy(emailThreads.id, companies.id, users.id)
      .orderBy(desc(emailThreads.createdAt))
      .limit(limit || 100)
      .offset(offset || 0);
    
    return results.map(row => ({
      id: row.id,
      userId: row.userId,
      companyId: row.companyId,
      subject: row.subject,
      threadId: row.threadId,
      requestToken: row.requestToken,
      replyToEmail: row.replyToEmail,
      status: row.status,
      createdAt: row.createdAt,
      aiMode: row.aiMode,
      company: row.company,
      user: row.user,
      emailCount: Number(row.emailCount),
      lastEmailAt: row.lastEmailAt
    }));
  }

  async createEmailThread(insertThread: InsertEmailThread): Promise<EmailThread> {
    const { db } = await import("./db");
    const { emailThreads } = await import("@shared/schema");
    const [thread] = await db.insert(emailThreads).values(insertThread).returning();
    return thread;
  }

  async updateEmailThread(id: string, updates: Partial<InsertEmailThread>): Promise<EmailThread> {
    const { db } = await import("./db");
    const { emailThreads } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [thread] = await db.update(emailThreads).set(updates).where(eq(emailThreads.id, id)).returning();
    return thread;
  }

  // Emails
  async getEmail(id: string): Promise<Email | undefined> {
    const { db } = await import("./db");
    const { emails } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [email] = await db.select().from(emails).where(eq(emails.id, id));
    return email || undefined;
  }

  async getThreadEmails(threadId: string, direction?: string): Promise<Email[]> {
    const { db } = await import("./db");
    const { emails } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    
    if (direction) {
      return await db.select().from(emails).where(
        and(eq(emails.threadId, threadId), eq(emails.direction, direction))
      );
    }
    return await db.select().from(emails).where(eq(emails.threadId, threadId));
  }

  async createEmail(insertEmail: InsertEmail): Promise<Email> {
    const { db } = await import("./db");
    const { emails } = await import("@shared/schema");
    const [email] = await db.insert(emails).values(insertEmail).returning();
    return email;
  }

  async updateEmail(id: string, updates: Partial<InsertEmail>): Promise<Email> {
    const { db } = await import("./db");
    const { emails } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [email] = await db.update(emails).set(updates).where(eq(emails.id, id)).returning();
    if (!email) throw new Error("Email not found");
    return email;
  }

  async getEmailById(id: string): Promise<Email | undefined> {
    const { db } = await import("./db");
    const { emails } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [email] = await db.select().from(emails).where(eq(emails.id, id));
    return email;
  }

  async getEmailWithThread(id: string): Promise<{ email: Email; thread: EmailThread } | undefined> {
    const { db } = await import("./db");
    const { emails, emailThreads } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    const [result] = await db.select({
      email: emails,
      thread: emailThreads
    })
      .from(emails)
      .innerJoin(emailThreads, eq(emails.threadId, emailThreads.id))
      .where(eq(emails.id, id));
    
    return result;
  }

  async getThreadDraftEmails(threadId: string): Promise<Email[]> {
    const { db } = await import("./db");
    const { emails } = await import("@shared/schema");
    const { eq, and, desc } = await import("drizzle-orm");
    return db.select().from(emails)
      .where(and(eq(emails.threadId, threadId), eq(emails.status, "draft")))
      .orderBy(desc(emails.createdAt));
  }

  async getDraftEmailsByUser(userId: string): Promise<Array<Email & { thread: EmailThread; company: Company | null }>> {
    const { db } = await import("./db");
    const { emails, emailThreads, companies } = await import("@shared/schema");
    const { eq, desc } = await import("drizzle-orm");
    
    const results = await db.select({
      email: emails,
      thread: emailThreads,
      company: companies
    })
      .from(emails)
      .innerJoin(emailThreads, eq(emails.threadId, emailThreads.id))
      .leftJoin(companies, eq(emailThreads.companyId, companies.id))
      .where(eq(emails.status, "draft"))
      .orderBy(desc(emails.createdAt));
    
    // userId 'all' returns all drafts (for admin/lookup purposes)
    if (userId === 'all') {
      return results.map(r => ({
        ...r.email,
        thread: r.thread,
        company: r.company
      }));
    }
    
    return results
      .filter(r => r.thread.userId === userId)
      .map(r => ({
        ...r.email,
        thread: r.thread,
        company: r.company
      }));
  }

  async getAllDraftEmails(): Promise<Array<Email & { thread: EmailThread; company: Company | null; user: User | null }>> {
    const { db } = await import("./db");
    const { emails, emailThreads, companies, users } = await import("@shared/schema");
    const { eq, desc } = await import("drizzle-orm");
    
    const results = await db.select({
      email: emails,
      thread: emailThreads,
      company: companies,
      user: users
    })
      .from(emails)
      .innerJoin(emailThreads, eq(emails.threadId, emailThreads.id))
      .leftJoin(companies, eq(emailThreads.companyId, companies.id))
      .leftJoin(users, eq(emailThreads.userId, users.id))
      .where(eq(emails.status, "draft"))
      .orderBy(desc(emails.createdAt));
    
    return results.map(r => ({
      ...r.email,
      thread: r.thread,
      company: r.company,
      user: r.user
    }));
  }

  // AI Debug Reports
  async createAiDebugReport(report: InsertAiDebugReport): Promise<AiDebugReport> {
    const { db } = await import("./db");
    const { aiDebugReports } = await import("@shared/schema");
    const [created] = await db.insert(aiDebugReports).values(report).returning();
    return created;
  }

  async getAiDebugReports(threadId?: string, limit = 50): Promise<AiDebugReport[]> {
    const { db } = await import("./db");
    const { aiDebugReports } = await import("@shared/schema");
    const { eq, desc } = await import("drizzle-orm");
    
    let query = db.select().from(aiDebugReports).orderBy(desc(aiDebugReports.createdAt)).limit(limit);
    
    if (threadId) {
      return db.select().from(aiDebugReports)
        .where(eq(aiDebugReports.threadId, threadId))
        .orderBy(desc(aiDebugReports.createdAt))
        .limit(limit);
    }
    
    return query;
  }

  async getAiDebugReportByMessageId(aiMessageId: string): Promise<AiDebugReport | undefined> {
    const { db } = await import("./db");
    const { aiDebugReports } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [report] = await db.select().from(aiDebugReports)
      .where(eq(aiDebugReports.aiMessageId, aiMessageId));
    return report;
  }

  // Comparisons
  async getComparison(id: string): Promise<Comparison | undefined> {
    const { db } = await import("./db");
    const { comparisons } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [comparison] = await db.select().from(comparisons).where(eq(comparisons.id, id));
    return comparison || undefined;
  }

  async getUserComparisons(userId: string): Promise<Comparison[]> {
    const { db } = await import("./db");
    const { comparisons } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    return await db.select().from(comparisons).where(eq(comparisons.userId, userId));
  }

  async getComparisonByUserAndCompany(userId: string, companyId: string): Promise<Comparison | undefined> {
    const { db } = await import("./db");
    const { comparisons } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    const [comparison] = await db.select().from(comparisons).where(
      and(eq(comparisons.userId, userId), eq(comparisons.companyId, companyId))
    );
    return comparison || undefined;
  }

  async getComparisonsByUserAndCompany(userId: string, companyId: string): Promise<Comparison[]> {
    const { db } = await import("./db");
    const { comparisons } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    return await db.select().from(comparisons).where(
      and(eq(comparisons.userId, userId), eq(comparisons.companyId, companyId))
    );
  }

  async getComparisonsByOfferDocument(offerDocumentId: string): Promise<Comparison[]> {
    const { db } = await import("./db");
    const { comparisons } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    return await db.select().from(comparisons).where(eq(comparisons.offerDocumentId, offerDocumentId));
  }

  async createComparison(insertComparison: InsertComparison): Promise<Comparison> {
    const { db } = await import("./db");
    const { comparisons } = await import("@shared/schema");
    const [comparison] = await db.insert(comparisons).values(insertComparison).returning();
    return comparison;
  }

  // Company Comparisons (Phase 4)
  async getCompanyComparison(id: string): Promise<CompanyComparison | undefined> {
    const { db } = await import("./db");
    const { companyComparisons } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [comparison] = await db.select().from(companyComparisons).where(eq(companyComparisons.id, id));
    return comparison || undefined;
  }

  async getCompanyComparisonsByUser(userId: string): Promise<CompanyComparison[]> {
    const { db } = await import("./db");
    const { companyComparisons } = await import("@shared/schema");
    const { eq, desc } = await import("drizzle-orm");
    return await db.select()
      .from(companyComparisons)
      .where(eq(companyComparisons.userId, userId))
      .orderBy(desc(companyComparisons.createdAt));
  }

  async getCompanyComparisonByCompanies(
    userId: string,
    currentCompany: string,
    offerCompany: string
  ): Promise<CompanyComparison | undefined> {
    const { db } = await import("./db");
    const { companyComparisons } = await import("@shared/schema");
    const { eq, and, desc } = await import("drizzle-orm");
    const [comparison] = await db.select()
      .from(companyComparisons)
      .where(
        and(
          eq(companyComparisons.userId, userId),
          eq(companyComparisons.currentCompany, currentCompany),
          eq(companyComparisons.offerCompany, offerCompany)
        )
      )
      .orderBy(desc(companyComparisons.createdAt))
      .limit(1);
    return comparison || undefined;
  }

  async createCompanyComparison(insertComparison: InsertCompanyComparison): Promise<CompanyComparison> {
    const { db } = await import("./db");
    const { companyComparisons } = await import("@shared/schema");
    const [comparison] = await db.insert(companyComparisons).values(insertComparison).returning();
    return comparison;
  }

  async updateCompanyComparisonStatus(
    id: string,
    status: string,
    comparisonJSON?: any,
    errorMessage?: string,
    statusReason?: string
  ): Promise<CompanyComparison> {
    const { db } = await import("./db");
    const { companyComparisons } = await import("@shared/schema");
    const { eq, sql } = await import("drizzle-orm");
    
    const updates: any = {
      status,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    };
    
    if (comparisonJSON !== undefined) {
      updates.comparisonJSON = comparisonJSON;
    }
    
    if (errorMessage !== undefined) {
      updates.errorMessage = errorMessage;
    }
    
    if (statusReason !== undefined) {
      updates.statusReason = statusReason;
    }
    
    const [comparison] = await db.update(companyComparisons)
      .set(updates)
      .where(eq(companyComparisons.id, id))
      .returning();
    
    return comparison;
  }

  async getActiveCompanyComparisonsByUser(userId: string): Promise<CompanyComparison[]> {
    const { db } = await import("./db");
    const { companyComparisons } = await import("@shared/schema");
    const { eq, and, desc } = await import("drizzle-orm");
    return await db.select()
      .from(companyComparisons)
      .where(
        and(
          eq(companyComparisons.userId, userId),
          eq(companyComparisons.isSuperseded, false)
        )
      )
      .orderBy(desc(companyComparisons.createdAt));
  }

  async supersedeCompanyComparisons(
    userId: string,
    currentCompany: string,
    offerCompany: string
  ): Promise<number> {
    const { db } = await import("./db");
    const { companyComparisons } = await import("@shared/schema");
    const { eq, and, sql } = await import("drizzle-orm");
    
    const result = await db.update(companyComparisons)
      .set({
        isSuperseded: true,
        updatedAt: sql`CURRENT_TIMESTAMP`
      })
      .where(
        and(
          eq(companyComparisons.userId, userId),
          eq(companyComparisons.currentCompany, currentCompany),
          eq(companyComparisons.offerCompany, offerCompany),
          eq(companyComparisons.isSuperseded, false)
        )
      )
      .returning();
    
    return result.length;
  }

  // Household Members
  async getHouseholdMember(id: string): Promise<HouseholdMember | undefined> {
    const { db } = await import("./db");
    const { householdMembers } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [member] = await db.select().from(householdMembers).where(eq(householdMembers.id, id));
    return member || undefined;
  }

  async getUserHouseholdMembers(userId: string): Promise<HouseholdMember[]> {
    const { db } = await import("./db");
    const { householdMembers } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    return await db.select().from(householdMembers).where(eq(householdMembers.userId, userId));
  }

  async createHouseholdMember(insertMember: InsertHouseholdMember): Promise<HouseholdMember> {
    const { db } = await import("./db");
    const { householdMembers } = await import("@shared/schema");
    const [member] = await db.insert(householdMembers).values(insertMember).returning();
    return member;
  }

  async updateHouseholdMember(id: string, updates: Partial<InsertHouseholdMember>): Promise<HouseholdMember> {
    const { db } = await import("./db");
    const { householdMembers } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [member] = await db.update(householdMembers).set(updates).where(eq(householdMembers.id, id)).returning();
    return member;
  }

  async deleteHouseholdMember(id: string): Promise<void> {
    const { db } = await import("./db");
    const { householdMembers } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    await db.delete(householdMembers).where(eq(householdMembers.id, id));
  }

  // Comparison Current Snapshots (Step 5.3)
  async getComparisonCurrentSnapshots(comparisonId: string): Promise<ComparisonCurrentSnapshot[]> {
    const { db } = await import("./db");
    const { comparisonCurrentSnapshots } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    return await db.select().from(comparisonCurrentSnapshots).where(eq(comparisonCurrentSnapshots.comparisonId, comparisonId));
  }

  async createComparisonCurrentSnapshot(snapshot: InsertComparisonCurrentSnapshot): Promise<ComparisonCurrentSnapshot> {
    const { db } = await import("./db");
    const { comparisonCurrentSnapshots } = await import("@shared/schema");
    const [result] = await db.insert(comparisonCurrentSnapshots).values(snapshot).returning();
    return result;
  }

  async freezeCurrentSnapshotsForComparison(comparisonId: string, userId: string): Promise<ComparisonCurrentSnapshot[]> {
    const { db } = await import("./db");
    const { policySnapshots, comparisonCurrentSnapshots } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    
    const currentSnapshots = await db.select().from(policySnapshots).where(
      and(
        eq(policySnapshots.userId, userId),
        eq(policySnapshots.kind, 'current'),
        eq(policySnapshots.isActive, true),
        eq(policySnapshots.status, 'active')
      )
    );
    
    const frozenSnapshots: ComparisonCurrentSnapshot[] = [];
    for (const snapshot of currentSnapshots) {
      const [frozen] = await db.insert(comparisonCurrentSnapshots).values({
        comparisonId,
        policySnapshotId: snapshot.id,
        policyType: snapshot.policyType,
        companyName: snapshot.companyName
      }).returning();
      frozenSnapshots.push(frozen);
    }
    
    return frozenSnapshots;
  }

  // Policies
  async getPolicy(id: string): Promise<Policy | undefined> {
    const { db } = await import("./db");
    const { policies } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const result = await db.select().from(policies).where(eq(policies.id, id));
    return result[0];
  }

  async getPoliciesByUser(userId: string): Promise<Policy[]> {
    const { db } = await import("./db");
    const { policies } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    return db.select().from(policies).where(eq(policies.userId, userId));
  }

  async getPoliciesByTypeAndUser(userId: string, policyType: string, isOwnPolicy?: boolean): Promise<Policy[]> {
    const { db } = await import("./db");
    const { policies } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    
    const conditions = [eq(policies.userId, userId), eq(policies.policyType, policyType)];
    if (isOwnPolicy !== undefined) {
      conditions.push(eq(policies.isOwnPolicy, isOwnPolicy));
    }
    
    return db.select().from(policies).where(and(...conditions));
  }

  async getPoliciesByDocument(documentId: string): Promise<Policy[]> {
    const { db } = await import("./db");
    const { policies } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    return db.select().from(policies).where(eq(policies.documentId, documentId));
  }

  async createPolicy(policy: InsertPolicy): Promise<Policy> {
    const { db } = await import("./db");
    const { policies } = await import("@shared/schema");
    const result = await db.insert(policies).values(policy).returning();
    return result[0];
  }

  async updatePolicy(id: string, updates: Partial<InsertPolicy>): Promise<Policy> {
    const { db } = await import("./db");
    const { policies } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const result = await db.update(policies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(policies.id, id))
      .returning();
    return result[0];
  }

  async updatePolicyHealthCheck(id: string, healthCheckData: {
    status: string;
    payload: any;
    savingsAnnual: number;
  }): Promise<Policy> {
    const { db } = await import("./db");
    const { policies } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const result = await db.update(policies)
      .set({
        healthCheckStatus: healthCheckData.status,
        healthCheckPayload: healthCheckData.payload,
        healthCheckSavingsAnnual: healthCheckData.savingsAnnual.toString() as any,
        healthCheckUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(policies.id, id))
      .returning();
    return result[0];
  }

  async deletePolicy(id: string): Promise<void> {
    const { db } = await import("./db");
    const { policies } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    await db.delete(policies).where(eq(policies.id, id));
  }

  async detectDuplicatePolicies(
    userId: string,
    policyType: string,
    companyId: string | null,
    premium: number | null
  ): Promise<Policy[]> {
    const { db } = await import("./db");
    const { policies } = await import("@shared/schema");
    const { eq, and, sql } = await import("drizzle-orm");
    
    const conditions = [
      eq(policies.userId, userId),
      eq(policies.policyType, policyType)
    ];
    
    if (companyId) {
      conditions.push(eq(policies.companyId, companyId));
    }
    
    if (premium) {
      // Allow 100 DKK difference for potential duplicates
      conditions.push(
        sql`ABS(${policies.premium} - ${premium}) <= 100`
      );
    }
    
    return db.select().from(policies).where(and(...conditions));
  }

  // Offer Snapshots
  async getOfferSnapshot(id: string): Promise<OfferSnapshot | undefined> {
    const { db } = await import("./db");
    const { offerSnapshots } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [snapshot] = await db.select().from(offerSnapshots).where(eq(offerSnapshots.id, id));
    return snapshot || undefined;
  }

  async getOfferSnapshotsByDocument(documentId: string): Promise<OfferSnapshot[]> {
    const { db } = await import("./db");
    const { offerSnapshots } = await import("@shared/schema");
    const { eq, asc } = await import("drizzle-orm");
    // Phase 2: Add ORDER BY createdAt for deterministic ordering
    return db.select()
      .from(offerSnapshots)
      .where(eq(offerSnapshots.documentId, documentId))
      .orderBy(asc(offerSnapshots.createdAt));
  }

  async getOfferSnapshotsByUser(userId: string, validationStatus?: string): Promise<OfferSnapshot[]> {
    const { db } = await import("./db");
    const { offerSnapshots } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    
    const conditions = [eq(offerSnapshots.userId, userId)];
    if (validationStatus) {
      conditions.push(eq(offerSnapshots.validationStatus, validationStatus));
    }
    
    return db.select().from(offerSnapshots).where(conditions.length > 1 ? and(...conditions) : conditions[0]);
  }

  async getOfferSnapshotByPolicy(policyId: string): Promise<OfferSnapshot | undefined> {
    const { db } = await import("./db");
    const { offerSnapshots } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [snapshot] = await db.select().from(offerSnapshots).where(eq(offerSnapshots.policyId, policyId));
    return snapshot || undefined;
  }

  async createOfferSnapshot(insertSnapshot: InsertOfferSnapshot): Promise<OfferSnapshot> {
    const { db } = await import("./db");
    const { offerSnapshots } = await import("@shared/schema");
    const [snapshot] = await db.insert(offerSnapshots).values(insertSnapshot).returning();
    return snapshot;
  }

  async updateOfferSnapshot(id: string, updates: Partial<InsertOfferSnapshot>): Promise<OfferSnapshot> {
    const { db } = await import("./db");
    const { offerSnapshots } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [snapshot] = await db.update(offerSnapshots)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(offerSnapshots.id, id))
      .returning();
    return snapshot;
  }

  // Health Checks
  async getHealthCheck(id: string): Promise<HealthCheck | undefined> {
    const { db } = await import("./db");
    const { healthChecks } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [healthCheck] = await db.select().from(healthChecks).where(eq(healthChecks.id, id));
    return healthCheck || undefined;
  }

  async getHealthChecksByDocument(documentId: string): Promise<HealthCheck[]> {
    const { db } = await import("./db");
    const { healthChecks } = await import("@shared/schema");
    const { eq, desc } = await import("drizzle-orm");
    return db.select()
      .from(healthChecks)
      .where(eq(healthChecks.documentId, documentId))
      .orderBy(desc(healthChecks.createdAt));
  }

  async getLatestHealthCheckByDocument(documentId: string): Promise<HealthCheck | undefined> {
    const { db } = await import("./db");
    const { healthChecks } = await import("@shared/schema");
    const { eq, desc } = await import("drizzle-orm");
    const [healthCheck] = await db.select()
      .from(healthChecks)
      .where(eq(healthChecks.documentId, documentId))
      .orderBy(desc(healthChecks.createdAt))
      .limit(1);
    return healthCheck || undefined;
  }

  async getHealthCheckBySnapshot(snapshotId: string): Promise<HealthCheck | undefined> {
    const { db } = await import("./db");
    const { healthChecks } = await import("@shared/schema");
    const { eq, desc } = await import("drizzle-orm");
    const [healthCheck] = await db.select()
      .from(healthChecks)
      .where(eq(healthChecks.snapshotId, snapshotId))
      .orderBy(desc(healthChecks.createdAt))
      .limit(1);
    return healthCheck || undefined;
  }

  async getHealthChecksByUser(userId: string, limit = 50, offset = 0): Promise<HealthCheck[]> {
    const { db } = await import("./db");
    const { healthChecks } = await import("@shared/schema");
    const { eq, desc } = await import("drizzle-orm");
    return db.select()
      .from(healthChecks)
      .where(eq(healthChecks.userId, userId))
      .orderBy(desc(healthChecks.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async createHealthCheck(insertHealthCheck: InsertHealthCheck): Promise<HealthCheck> {
    const { db } = await import("./db");
    const { healthChecks } = await import("@shared/schema");
    const [healthCheck] = await db.insert(healthChecks).values(insertHealthCheck).returning();
    return healthCheck;
  }

  async deleteHealthCheck(id: string): Promise<void> {
    const { db } = await import("./db");
    const { healthChecks } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    await db.delete(healthChecks).where(eq(healthChecks.id, id));
  }

  async getNavigationData(userId: string): Promise<{
    companies: Array<{
      companyId: string;
      comparisonId: string;
      companyName: string;
      policyTypes: string[];
      hasCombinedView: boolean;
    }>;
    pendingThreads: Array<EmailThread & { companyName: string }>;
    currentInsuranceSnapshotId: string | null;
  }> {
    const { db } = await import("./db");
    const { companyComparisons, emailThreads, companies, policySnapshots } = await import("@shared/schema");
    const { eq, and, or, desc } = await import("drizzle-orm");

    // Fetch completed company_comparisons with company names using SQL join
    const userCompanyComparisons = await db
      .select({
        comparison: companyComparisons,
        company: companies
      })
      .from(companyComparisons)
      .leftJoin(companies, eq(companyComparisons.offerCompany, companies.id))
      .where(
        and(
          eq(companyComparisons.userId, userId),
          eq(companyComparisons.status, 'completed')
        )
      )
      .orderBy(desc(companyComparisons.createdAt));

    // Group by offer company, using the most recent comparison for each company
    const companyMap = new Map<string, { 
      name: string; 
      policyTypes: Set<string>;
      comparisonId: string;
    }>();
    
    for (const row of userCompanyComparisons) {
      const companyId = row.comparison.offerCompany || '';
      const companyName = row.company?.name || 'Unknown Company';
      
      // Only use the first (most recent) comparison per company
      if (!companyMap.has(companyId)) {
        companyMap.set(companyId, {
          name: companyName,
          policyTypes: new Set(),
          comparisonId: row.comparison.id
        });
        
        // Extract policy types from comparison_json.overall.perPolicySummary
        const comparisonJSON = row.comparison.comparisonJSON as any;
        const perPolicySummary = comparisonJSON?.overall?.perPolicySummary || [];
        for (const policy of perPolicySummary) {
          if (policy.policyType) {
            companyMap.get(companyId)!.policyTypes.add(policy.policyType);
          }
        }
      }
    }
    
    const companiesData = Array.from(companyMap.entries()).map(([offerCompanyId, data]) => {
      const policyTypes = Array.from(data.policyTypes);
      return {
        companyId: offerCompanyId, // Keep original company ID for grouping/expansion
        comparisonId: data.comparisonId, // Use comparison ID for URL routing
        companyName: data.name,
        policyTypes,
        hasCombinedView: policyTypes.length > 1
      };
    });

    // Fetch pending threads with company names using SQL join
    const userThreads = await db
      .select({
        thread: emailThreads,
        company: companies
      })
      .from(emailThreads)
      .leftJoin(companies, eq(emailThreads.companyId, companies.id))
      .where(
        and(
          eq(emailThreads.userId, userId),
          or(
            eq(emailThreads.status, 'sent'),
            eq(emailThreads.status, 'pending')
          )
        )
      );

    const threadsWithCompany = userThreads.map(row => ({
      ...row.thread,
      companyName: row.company?.name || 'Unknown Company'
    }));

    // Get first current insurance policy snapshot for navigation link
    // Step 1.2: Only get ACTIVE current policies (non-archived)
    const [currentSnapshot] = await db
      .select({ id: policySnapshots.id })
      .from(policySnapshots)
      .where(
        and(
          eq(policySnapshots.userId, userId),
          eq(policySnapshots.kind, 'current'),
          eq(policySnapshots.isActive, true)
        )
      )
      .orderBy(desc(policySnapshots.createdAt))
      .limit(1);

    return {
      companies: companiesData,
      pendingThreads: threadsWithCompany,
      currentInsuranceSnapshotId: currentSnapshot?.id || null
    };
  }

  // Onboarding Progress
  async getOnboardingProgressByEmail(email: string): Promise<OnboardingProgress | undefined> {
    const { db } = await import("./db");
    const { onboardingProgress } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [progress] = await db.select().from(onboardingProgress).where(eq(onboardingProgress.email, email));
    return progress || undefined;
  }

  async createOnboardingProgress(insertProgress: InsertOnboardingProgress): Promise<OnboardingProgress> {
    const { db } = await import("./db");
    const { onboardingProgress } = await import("@shared/schema");
    const [progress] = await db.insert(onboardingProgress).values(insertProgress).returning();
    return progress;
  }

  async updateOnboardingProgress(email: string, updates: Partial<InsertOnboardingProgress>): Promise<OnboardingProgress> {
    const { db } = await import("./db");
    const { onboardingProgress } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [progress] = await db.update(onboardingProgress)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(onboardingProgress.email, email))
      .returning();
    
    if (!progress) {
      throw new Error('Onboarding progress not found');
    }
    
    return progress;
  }

  // Benchmark Prices
  async getBenchmarkPrice(policyType: string): Promise<number | null> {
    const { db } = await import("./db");
    const { benchmarkPrices } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [benchmark] = await db.select().from(benchmarkPrices).where(eq(benchmarkPrices.policyType, policyType));
    return benchmark?.annualPremium ?? null;
  }

  async getAllBenchmarkPrices(): Promise<Array<{ policyType: string; annualPremium: number }>> {
    const { db } = await import("./db");
    const { benchmarkPrices } = await import("@shared/schema");
    const results = await db.select().from(benchmarkPrices);
    return results.map(r => ({ policyType: r.policyType, annualPremium: r.annualPremium }));
  }

  async setBenchmarkPrice(policyType: string, annualPremium: number): Promise<void> {
    const { db } = await import("./db");
    const { benchmarkPrices } = await import("@shared/schema");
    await db.insert(benchmarkPrices)
      .values({ policyType, annualPremium, updatedAt: new Date() })
      .onConflictDoUpdate({ 
        target: benchmarkPrices.policyType, 
        set: { annualPremium, updatedAt: new Date() } 
      });
  }

  // Magic Links
  async getMagicLinkByToken(token: string): Promise<MagicLink | undefined> {
    const { db } = await import("./db");
    const { magicLinks } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [magicLink] = await db.select().from(magicLinks).where(eq(magicLinks.token, token));
    return magicLink || undefined;
  }

  async getMagicLinksByComparison(comparisonId: string): Promise<MagicLink[]> {
    const { db } = await import("./db");
    const { magicLinks } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const results = await db.select().from(magicLinks).where(eq(magicLinks.comparisonId, comparisonId));
    return results;
  }

  async createMagicLink(insertMagicLink: InsertMagicLink): Promise<MagicLink> {
    const { db } = await import("./db");
    const { magicLinks } = await import("@shared/schema");
    const [magicLink] = await db.insert(magicLinks).values(insertMagicLink).returning();
    return magicLink;
  }

  async updateMagicLinkConsumed(id: string): Promise<MagicLink> {
    const { db } = await import("./db");
    const { magicLinks } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [magicLink] = await db.update(magicLinks)
      .set({ consumedAt: new Date() })
      .where(eq(magicLinks.id, id))
      .returning();
    
    if (!magicLink) {
      throw new Error('Magic link not found');
    }
    
    return magicLink;
  }

  // Notifications
  async getNotification(id: string): Promise<Notification | undefined> {
    const { db } = await import("./db");
    const { notifications } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
    return notification || undefined;
  }

  async getNotificationByComparison(comparisonId: string, type: string): Promise<Notification | undefined> {
    const { db } = await import("./db");
    const { notifications } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    const [notification] = await db.select().from(notifications).where(
      and(
        eq(notifications.comparisonId, comparisonId),
        eq(notifications.type, type)
      )
    );
    return notification || undefined;
  }

  async getNotificationsByComparison(comparisonId: string): Promise<Notification[]> {
    const { db } = await import("./db");
    const { notifications } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const results = await db.select().from(notifications).where(eq(notifications.comparisonId, comparisonId));
    return results;
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const { db } = await import("./db");
    const { notifications } = await import("@shared/schema");
    const [notification] = await db.insert(notifications).values(insertNotification).returning();
    return notification;
  }

  async updateNotificationStatus(id: string, status: string, errorMessage?: string): Promise<Notification> {
    const { db } = await import("./db");
    const { notifications } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [notification] = await db.update(notifications)
      .set({ 
        status, 
        errorMessage: errorMessage || null,
        sentAt: status === 'sent' ? new Date() : undefined
      })
      .where(eq(notifications.id, id))
      .returning();
    
    if (!notification) {
      throw new Error('Notification not found');
    }
    
    return notification;
  }

  // Company Comparison notified_at
  async updateCompanyComparisonNotifiedAt(id: string): Promise<CompanyComparison> {
    const { db } = await import("./db");
    const { companyComparisons } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [comparison] = await db.update(companyComparisons)
      .set({ notifiedAt: new Date() })
      .where(eq(companyComparisons.id, id))
      .returning();
    
    if (!comparison) {
      throw new Error('Company comparison not found');
    }
    
    return comparison;
  }

  // Step 5.1: Company Comparison notification status
  async updateCompanyComparisonNotificationState(
    id: string, 
    status: "pending" | "sent" | "failed" | "not_required",
    error?: string | null
  ): Promise<CompanyComparison> {
    const { db } = await import("./db");
    const { companyComparisons } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    const updateData: Record<string, any> = {
      notificationStatus: status,
      notificationError: error || null,
      updatedAt: new Date()
    };
    
    // Also set notifiedAt when status is 'sent'
    if (status === 'sent') {
      updateData.notifiedAt = new Date();
    }
    
    const [comparison] = await db.update(companyComparisons)
      .set(updateData)
      .where(eq(companyComparisons.id, id))
      .returning();
    
    if (!comparison) {
      throw new Error('Company comparison not found');
    }
    
    return comparison;
  }

  // Waitlist
  async addToWaitlist(email: string): Promise<void> {
    const { db } = await import("./db");
    const { waitlist } = await import("@shared/schema");
    await db.insert(waitlist).values({ email });
  }
}

export const storage = new DatabaseStorage();

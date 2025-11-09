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
  type HouseholdMember,
  type InsertHouseholdMember,
  type Policy,
  type InsertPolicy,
  type OnboardingProgress,
  type InsertOnboardingProgress
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
  getUserDocuments(userId: string, documentType?: string, limit?: number, offset?: number): Promise<Document[]>;
  countUserDocuments(userId: string, documentType?: string): Promise<number>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document>;
  deleteDocument(id: string): Promise<void>;

  // Email Threads
  getEmailThread(id: string): Promise<EmailThread | undefined>;
  getEmailThreadByGmailId(gmailThreadId: string): Promise<EmailThread | undefined>;
  getEmailThreadByToken(token: string): Promise<EmailThread | undefined>;
  getEmailThreadByCompany(userId: string, companyId: string): Promise<EmailThread | undefined>;
  getUserEmailThreads(userId: string): Promise<EmailThread[]>;
  getUserEmailThreadsEnriched(userId: string, limit?: number, offset?: number): Promise<Array<EmailThread & { company: Company | null; emailCount: number; lastEmailAt: Date | null }>>;
  createEmailThread(thread: InsertEmailThread): Promise<EmailThread>;
  updateEmailThread(id: string, updates: Partial<InsertEmailThread>): Promise<EmailThread>;

  // Emails
  getEmail(id: string): Promise<Email | undefined>;
  getThreadEmails(threadId: string, direction?: string): Promise<Email[]>;
  createEmail(email: InsertEmail): Promise<Email>;

  // Comparisons
  getComparison(id: string): Promise<Comparison | undefined>;
  getUserComparisons(userId: string): Promise<Comparison[]>;
  getComparisonByUserAndCompany(userId: string, companyId: string): Promise<Comparison | undefined>;
  getComparisonsByUserAndCompany(userId: string, companyId: string): Promise<Comparison[]>;
  createComparison(comparison: InsertComparison): Promise<Comparison>;

  // Household Members
  getHouseholdMember(id: string): Promise<HouseholdMember | undefined>;
  getUserHouseholdMembers(userId: string): Promise<HouseholdMember[]>;
  createHouseholdMember(member: InsertHouseholdMember): Promise<HouseholdMember>;
  updateHouseholdMember(id: string, updates: Partial<InsertHouseholdMember>): Promise<HouseholdMember>;
  deleteHouseholdMember(id: string): Promise<void>;

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

  // Navigation Data
  getNavigationData(userId: string): Promise<{
    companies: Array<{
      companyId: string;
      companyName: string;
      policyTypes: string[];
      hasCombinedView: boolean;
    }>;
    pendingThreads: Array<EmailThread & { companyName: string }>;
  }>;

  // Onboarding Progress
  getOnboardingProgressByEmail(email: string): Promise<OnboardingProgress | undefined>;
  createOnboardingProgress(progress: InsertOnboardingProgress): Promise<OnboardingProgress>;
  updateOnboardingProgress(email: string, updates: Partial<InsertOnboardingProgress>): Promise<OnboardingProgress>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private companies: Map<string, Company> = new Map();
  private documents: Map<string, Document> = new Map();
  private emailThreads: Map<string, EmailThread> = new Map();
  private emails: Map<string, Email> = new Map();
  private comparisons: Map<string, Comparison> = new Map();
  private householdMembers: Map<string, HouseholdMember> = new Map();
  private policies: Map<string, Policy> = new Map();
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
      ocrData: insertDocument.ocrData ?? null,
      ocrRawResponse: insertDocument.ocrRawResponse ?? null,
      extractionStatus: insertDocument.extractionStatus ?? null,
      totalPoliciesExtracted: insertDocument.totalPoliciesExtracted ?? null,
      documentType: insertDocument.documentType ?? null,
      companyId: insertDocument.companyId ?? null,
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
      createdAt: new Date() 
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
      createdAt: new Date() 
    };
    this.emails.set(id, email);
    return email;
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

  async getNavigationData(userId: string): Promise<{
    companies: Array<{
      companyId: string;
      companyName: string;
      policyTypes: string[];
      hasCombinedView: boolean;
    }>;
    pendingThreads: Array<EmailThread & { companyName: string }>;
  }> {
    const userComparisons = Array.from(this.comparisons.values())
      .filter(c => c.userId === userId);
    
    const companyMap = new Map<string, Set<string>>();
    
    for (const comparison of userComparisons) {
      const companyId = comparison.companyId || '';
      if (!companyMap.has(companyId)) {
        companyMap.set(companyId, new Set());
      }
      if (comparison.policyType) {
        companyMap.get(companyId)!.add(comparison.policyType);
      }
    }
    
    const companies = Array.from(companyMap.entries()).map(([companyId, policyTypesSet]) => {
      const company = this.companies.get(companyId);
      const policyTypes = Array.from(policyTypesSet);
      return {
        companyId,
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
      pendingThreads: threadsWithCompany
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

  async createComparison(insertComparison: InsertComparison): Promise<Comparison> {
    const { db } = await import("./db");
    const { comparisons } = await import("@shared/schema");
    const [comparison] = await db.insert(comparisons).values(insertComparison).returning();
    return comparison;
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

  async getNavigationData(userId: string): Promise<{
    companies: Array<{
      companyId: string;
      companyName: string;
      policyTypes: string[];
      hasCombinedView: boolean;
    }>;
    pendingThreads: Array<EmailThread & { companyName: string }>;
  }> {
    const { db } = await import("./db");
    const { comparisons, emailThreads, companies } = await import("@shared/schema");
    const { eq, and, or } = await import("drizzle-orm");

    // Fetch comparisons with company names using SQL join
    const userComparisons = await db
      .select({
        comparison: comparisons,
        company: companies
      })
      .from(comparisons)
      .leftJoin(companies, eq(comparisons.companyId, companies.id))
      .where(eq(comparisons.userId, userId));

    const companyMap = new Map<string, { name: string; policyTypes: Set<string> }>();
    
    for (const row of userComparisons) {
      const companyId = row.comparison.companyId || '';
      const companyName = row.company?.name || 'Unknown Company';
      
      if (!companyMap.has(companyId)) {
        companyMap.set(companyId, {
          name: companyName,
          policyTypes: new Set()
        });
      }
      
      if (row.comparison.policyType) {
        companyMap.get(companyId)!.policyTypes.add(row.comparison.policyType);
      }
    }
    
    const companiesData = Array.from(companyMap.entries()).map(([companyId, data]) => {
      const policyTypes = Array.from(data.policyTypes);
      return {
        companyId,
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

    return {
      companies: companiesData,
      pendingThreads: threadsWithCompany
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
}

export const storage = new DatabaseStorage();

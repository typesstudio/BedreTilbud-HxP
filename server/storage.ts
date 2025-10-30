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
  type InsertHouseholdMember
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
  getUserDocuments(userId: string, documentType?: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;

  // Email Threads
  getEmailThread(id: string): Promise<EmailThread | undefined>;
  getEmailThreadByGmailId(gmailThreadId: string): Promise<EmailThread | undefined>;
  getEmailThreadByToken(token: string): Promise<EmailThread | undefined>;
  getEmailThreadByCompany(userId: string, companyId: string): Promise<EmailThread | undefined>;
  getUserEmailThreads(userId: string): Promise<EmailThread[]>;
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
  createComparison(comparison: InsertComparison): Promise<Comparison>;

  // Household Members
  getHouseholdMember(id: string): Promise<HouseholdMember | undefined>;
  getUserHouseholdMembers(userId: string): Promise<HouseholdMember[]>;
  createHouseholdMember(member: InsertHouseholdMember): Promise<HouseholdMember>;
  updateHouseholdMember(id: string, updates: Partial<InsertHouseholdMember>): Promise<HouseholdMember>;
  deleteHouseholdMember(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private companies: Map<string, Company> = new Map();
  private documents: Map<string, Document> = new Map();
  private emailThreads: Map<string, EmailThread> = new Map();
  private emails: Map<string, Email> = new Map();
  private comparisons: Map<string, Comparison> = new Map();
  private householdMembers: Map<string, HouseholdMember> = new Map();

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
        active: true
      },
      {
        id: randomUUID(),
        name: "Tryg Forsikring", 
        email: "tilbud@tryg.dk",
        description: "Danmarks største forsikringsselskab",
        active: true
      },
      {
        id: randomUUID(),
        name: "Topdanmark",
        email: "tilbud@topdanmark.dk", 
        description: "Konkurrencedygtige priser",
        active: true
      },
      {
        id: randomUUID(),
        name: "svphil",
        email: "svphil@gmail.com",
        description: "Personlig forsikringsrådgiver",
        active: true
      },
      {
        id: randomUUID(),
        name: "Types Studio",
        email: "hello@typesstudio.com",
        description: "Moderne forsikringsløsninger",
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
      active: insertCompany.active ?? null
    };
    this.companies.set(id, company);
    return company;
  }

  // Documents
  async getDocument(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async getUserDocuments(userId: string, documentType?: string): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(doc => 
      doc.userId === userId && 
      (documentType ? doc.documentType === documentType : true)
    );
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
      documentType: insertDocument.documentType ?? null,
      companyId: insertDocument.companyId ?? null,
      createdAt: new Date() 
    };
    this.documents.set(id, document);
    return document;
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

  async createComparison(insertComparison: InsertComparison): Promise<Comparison> {
    const id = randomUUID();
    const comparison: Comparison = { 
      id,
      userId: insertComparison.userId ?? null,
      currentDocumentId: insertComparison.currentDocumentId ?? null,
      offerDocumentId: insertComparison.offerDocumentId ?? null,
      companyId: insertComparison.companyId ?? null,
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

  async getUserDocuments(userId: string, documentType?: string): Promise<Document[]> {
    const { db } = await import("./db");
    const { documents } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    
    if (documentType) {
      return await db.select().from(documents).where(
        and(eq(documents.userId, userId), eq(documents.documentType, documentType))
      );
    }
    return await db.select().from(documents).where(eq(documents.userId, userId));
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const { db } = await import("./db");
    const { documents } = await import("@shared/schema");
    const [doc] = await db.insert(documents).values(insertDocument).returning();
    return doc;
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
}

export const storage = new DatabaseStorage();

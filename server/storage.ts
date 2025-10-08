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
  type InsertComparison
} from "@shared/schema";
import { randomUUID } from "crypto";

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
  createComparison(comparison: InsertComparison): Promise<Comparison>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private companies: Map<string, Company> = new Map();
  private documents: Map<string, Document> = new Map();
  private emailThreads: Map<string, EmailThread> = new Map();
  private emails: Map<string, Email> = new Map();
  private comparisons: Map<string, Comparison> = new Map();

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
      housingType: insertUser.housingType ?? null,
      hasCar: insertUser.hasCar ?? null,
      deductible: insertUser.deductible ?? null,
      age: insertUser.age ?? null,
      additionalInfo: insertUser.additionalInfo ?? null,
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
}

export const storage = new MemStorage();

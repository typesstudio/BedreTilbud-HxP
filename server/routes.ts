import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ocrService } from "./services/ocrService";
import { comparisonService } from "./services/comparisonService";
import { emailService } from "./services/emailService";
import multer from "multer";
import path from "path";
import fs from "fs";
import { insertUserSchema, insertDocumentSchema } from "@shared/schema";
import { z } from "zod";

// Setup file upload
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // User routes
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get all users
  app.get("/api/users", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
      res.json(allUsers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    try {
      const updates = insertUserSchema.partial().parse(req.body);
      const user = await storage.updateUser(req.params.id, updates);
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Company routes
  app.get("/api/companies", async (req, res) => {
    try {
      const companies = await storage.getActiveCompanies();
      res.json(companies);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Document upload routes
  app.post("/api/documents/upload", upload.array('files'), async (req, res) => {
    try {
      const { userId, documentType = 'current' } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const documents = [];

      for (const file of files) {
        // Extract insurance data using OCR
        const ocrData = await ocrService.extractInsuranceDataFromPDF(file.path);
        
        const document = await storage.createDocument({
          userId,
          fileName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          ocrData,
          documentType,
          companyId: documentType === 'offer' ? req.body.companyId : undefined
        });

        documents.push(document);

        // If it's an offer, create a comparison with current policy
        if (documentType === 'offer' && req.body.companyId) {
          const currentDocuments = await storage.getUserDocuments(userId, 'current');
          if (currentDocuments.length > 0 && currentDocuments[0].ocrData) {
            const comparison = await comparisonService.compareInsurancePolicies(
              currentDocuments[0].ocrData as any,
              ocrData
            );

            await storage.createComparison({
              userId,
              currentDocumentId: currentDocuments[0].id,
              offerDocumentId: document.id,
              companyId: req.body.companyId,
              comparisonData: comparison,
              aiRecommendation: comparison.verdict === 'recommended' 
                ? 'Vi anbefaler dette tilbud - det giver dig bedre dækning til en lavere pris.'
                : comparison.verdict === 'not_recommended'
                ? 'Vi anbefaler ikke dette tilbud - dit nuværende forsikring er bedre.'
                : 'Dette tilbud kan være interessant - gennemgå fordele og ulemper nøje.',
              savings: comparison.savings || 0
            });
          }
        }
      }

      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/documents/user/:userId", async (req, res) => {
    try {
      const { documentType } = req.query;
      const documents = await storage.getUserDocuments(
        req.params.userId,
        documentType as string
      );
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reprocess documents with empty OCR data
  app.post("/api/documents/reprocess/:userId", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { documents: documentsTable, comparisons: comparisonsTable } = await import("@shared/schema");
      const { eq, and, isNull, or, sql } = await import("drizzle-orm");

      // Find documents with empty or null OCR data
      const docsToReprocess = await db
        .select()
        .from(documentsTable)
        .where(
          and(
            eq(documentsTable.userId, req.params.userId),
            or(
              isNull(documentsTable.ocrData),
              sql`${documentsTable.ocrData}::text = '{}'`
            )
          )
        );

      const reprocessedDocs = [];

      for (const doc of docsToReprocess) {
        try {
          console.log(`[Reprocess] Processing document: ${doc.fileName}`);
          const ocrData = await ocrService.extractInsuranceDataFromPDF(doc.filePath);
          
          // Update document with new OCR data
          await db
            .update(documentsTable)
            .set({ ocrData })
            .where(eq(documentsTable.id, doc.id));

          reprocessedDocs.push({ id: doc.id, fileName: doc.fileName, status: 'success' });

          // If it's an offer document, create/update comparison
          if (doc.documentType === 'offer' && doc.companyId) {
            const currentDocs = await storage.getUserDocuments(req.params.userId, 'current');
            if (currentDocs.length > 0 && currentDocs[0].ocrData) {
              const comparison = await comparisonService.compareInsurancePolicies(
                currentDocs[0].ocrData as any,
                ocrData
              );

              // Check if comparison exists
              const existingComparison = await db
                .select()
                .from(comparisonsTable)
                .where(
                  and(
                    eq(comparisonsTable.offerDocumentId, doc.id),
                    eq(comparisonsTable.currentDocumentId, currentDocs[0].id)
                  )
                );

              if (existingComparison.length > 0) {
                // Update existing comparison
                await db
                  .update(comparisonsTable)
                  .set({
                    comparisonData: comparison,
                    aiRecommendation: comparison.verdict === 'recommended' 
                      ? 'Vi anbefaler dette tilbud - det giver dig bedre dækning til en lavere pris.'
                      : comparison.verdict === 'not_recommended'
                      ? 'Vi anbefaler ikke dette tilbud - dit nuværende forsikring er bedre.'
                      : 'Dette tilbud kan være interessant - gennemgå fordele og ulemper nøje.',
                    savings: comparison.savings || 0
                  })
                  .where(eq(comparisonsTable.id, existingComparison[0].id));
              } else {
                // Create new comparison
                await storage.createComparison({
                  userId: req.params.userId,
                  currentDocumentId: currentDocs[0].id,
                  offerDocumentId: doc.id,
                  companyId: doc.companyId,
                  comparisonData: comparison,
                  aiRecommendation: comparison.verdict === 'recommended' 
                    ? 'Vi anbefaler dette tilbud - det giver dig bedre dækning til en lavere pris.'
                    : comparison.verdict === 'not_recommended'
                    ? 'Vi anbefaler ikke dette tilbud - dit nuværende forsikring er bedre.'
                    : 'Dette tilbud kan være interessant - gennemgå fordele og ulemper nøje.',
                  savings: comparison.savings || 0
                });
              }
            }
          }
        } catch (error: any) {
          console.error(`[Reprocess] Failed to process ${doc.fileName}:`, error);
          reprocessedDocs.push({ id: doc.id, fileName: doc.fileName, status: 'failed', error: error.message });
        }
      }

      res.json({
        message: `Reprocessed ${reprocessedDocs.length} documents`,
        documents: reprocessedDocs
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Email routes
  app.post("/api/emails/send-inquiries", async (req, res) => {
    try {
      const { userId, companyIds, customMessage } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user's current documents for attachments
      const currentDocs = await storage.getUserDocuments(userId, 'current');
      const attachmentPaths = currentDocs.map(doc => doc.filePath);

      const threadIds = [];

      for (const companyId of companyIds) {
        const company = await storage.getCompany(companyId);
        if (!company) continue;

        // Generate personalized email
        const emailBody = customMessage || await comparisonService.generatePersonalizedEmail(
          company.name,
          {
            housingType: user.housingType || undefined,
            hasCar: user.hasCar || undefined,
            deductible: user.deductible || undefined,
            additionalInfo: user.additionalInfo || undefined
          },
          currentDocs.map(doc => doc.ocrData).filter(Boolean) as any[]
        );

        const threadId = await emailService.sendInsuranceInquiry(
          userId,
          companyId,
          emailBody,
          attachmentPaths
        );

        threadIds.push(threadId);
      }

      res.json({ threadIds, message: "Inquiries sent successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/emails/threads/:userId", async (req, res) => {
    try {
      const threads = await storage.getUserEmailThreads(req.params.userId);
      
      // Enrich with company and email data
      const enrichedThreads = await Promise.all(
        threads.map(async (thread) => {
          const company = thread.companyId ? await storage.getCompany(thread.companyId) : null;
          const emails = await storage.getThreadEmails(thread.id);
          
          return {
            ...thread,
            company,
            emailCount: emails.length,
            lastEmailAt: emails.length > 0 ? emails[emails.length - 1].sentAt : null
          };
        })
      );

      res.json(enrichedThreads);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/emails/thread/:threadId", async (req, res) => {
    try {
      const thread = await storage.getEmailThread(req.params.threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      const emails = await storage.getThreadEmails(req.params.threadId);
      const company = thread.companyId ? await storage.getCompany(thread.companyId) : null;

      res.json({
        thread,
        company,
        emails
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Check for new emails
  app.post("/api/emails/check-inbox", async (req, res) => {
    try {
      await emailService.checkInbox();
      res.json({ message: "Inbox checked successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Comparison routes
  app.get("/api/comparisons/user/:userId", async (req, res) => {
    try {
      const comparisons = await storage.getUserComparisons(req.params.userId);
      
      // Enrich with document and company data
      const enrichedComparisons = await Promise.all(
        comparisons.map(async (comparison) => {
          const currentDoc = comparison.currentDocumentId 
            ? await storage.getDocument(comparison.currentDocumentId) 
            : null;
          const offerDoc = comparison.offerDocumentId 
            ? await storage.getDocument(comparison.offerDocumentId) 
            : null;
          const company = comparison.companyId 
            ? await storage.getCompany(comparison.companyId) 
            : null;

          return {
            ...comparison,
            currentDocument: currentDoc,
            offerDocument: offerDoc,
            company
          };
        })
      );

      res.json(enrichedComparisons);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/comparisons/:id", async (req, res) => {
    try {
      const comparison = await storage.getComparison(req.params.id);
      if (!comparison) {
        return res.status(404).json({ message: "Comparison not found" });
      }

      const currentDoc = comparison.currentDocumentId 
        ? await storage.getDocument(comparison.currentDocumentId) 
        : null;
      const offerDoc = comparison.offerDocumentId 
        ? await storage.getDocument(comparison.offerDocumentId) 
        : null;
      const company = comparison.companyId 
        ? await storage.getCompany(comparison.companyId) 
        : null;

      res.json({
        ...comparison,
        currentDocument: currentDoc,
        offerDocument: offerDoc,
        company
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Stats route
  app.get("/api/stats/:userId", async (req, res) => {
    try {
      const threads = await storage.getUserEmailThreads(req.params.userId);
      
      const stats = {
        sent: threads.filter(t => t.status === 'sent').length,
        pending: threads.filter(t => t.status === 'sent' || t.status === 'pending').length,
        received: threads.filter(t => t.status === 'received').length
      };

      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

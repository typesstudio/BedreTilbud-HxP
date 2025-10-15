import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { mistralOcrService as ocrService } from "./services/mistralOcrService";
import { comparisonService } from "./services/comparisonService";
import { emailService } from "./services/emailService";
import { gmailOAuthService } from "./services/gmailOAuthService";
import { requireAuth, requireOwnership } from "./middleware/auth";
import { validateFileUpload } from "./middleware/uploadValidation";
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
  // Health check endpoints
  app.get("/health", async (req, res) => {
    res.status(200).json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  app.get("/ready", async (req, res) => {
    try {
      // Check required environment variables
      const requiredEnvVars = ['OPENAI_API_KEY', 'MISTRAL_API_KEY', 'DATABASE_URL'];
      const missingVars = requiredEnvVars.filter(v => !process.env[v]);
      
      if (missingVars.length > 0) {
        return res.status(503).json({ 
          status: "not_ready", 
          error: `Missing environment variables: ${missingVars.join(', ')}`
        });
      }
      
      // Simple check - if we got here, we're ready
      res.status(200).json({ 
        status: "ready",
        timestamp: new Date().toISOString(),
        checks: {
          environment: "ok"
        }
      });
    } catch (error: any) {
      res.status(503).json({ 
        status: "not_ready", 
        error: error.message 
      });
    }
  });

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

  app.get("/api/users/:id", requireAuth, requireOwnership, async (req, res) => {
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

  app.put("/api/users/:id", requireAuth, requireOwnership, async (req, res) => {
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
  app.post("/api/documents/upload", requireAuth, upload.array('files'), validateFileUpload, async (req, res) => {
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

  app.get("/api/documents/user/:userId", requireAuth, async (req, res) => {
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
  app.post("/api/documents/reprocess/:userId", requireAuth, async (req, res) => {
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
  app.post("/api/emails/send-inquiries", requireAuth, async (req, res) => {
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

  app.get("/api/emails/threads/:userId", requireAuth, async (req, res) => {
    try {
      // Pagination support
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      const allThreads = await storage.getUserEmailThreads(req.params.userId);
      const totalCount = allThreads.length;
      const threads = allThreads.slice(offset, offset + limit);
      
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

      res.json({
        data: enrichedThreads,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: offset + limit < totalCount
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/emails/thread/:threadId", requireAuth, async (req, res) => {
    try {
      const thread = await storage.getEmailThread(req.params.threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      const emails = await storage.getThreadEmails(req.params.threadId);
      const company = thread.companyId ? await storage.getCompany(thread.companyId) : null;
      
      // Find the comparison for this thread
      const comparison = thread.userId && thread.companyId 
        ? await storage.getComparisonByUserAndCompany(thread.userId, thread.companyId)
        : null;

      res.json({
        thread,
        company,
        emails,
        comparisonId: comparison?.id || null
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Send custom message in thread
  app.post("/api/emails/thread/:threadId/send-message", async (req, res) => {
    try {
      console.log("📤 Sending custom message for thread:", req.params.threadId);
      const { message } = req.body;
      
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        console.log("❌ Validation failed: empty message");
        return res.status(400).json({ message: "Besked skal udfyldes" });
      }

      console.log("✅ Message validation passed:", message.substring(0, 50));

      const thread = await storage.getEmailThread(req.params.threadId);
      if (!thread) {
        console.log("❌ Thread not found:", req.params.threadId);
        return res.status(404).json({ message: "Email thread not found" });
      }

      console.log("✅ Thread found:", thread.subject);
      console.log("📧 Calling emailService.sendFollowUpEmail...");
      
      const email = await emailService.sendFollowUpEmail(req.params.threadId, message);
      
      console.log("✅ Email sent successfully, ID:", email.id);
      
      res.json({ 
        success: true,
        email,
        message: "Besked sendt succesfuldt" 
      });
    } catch (error: any) {
      console.error("❌ Failed to send custom message:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack?.substring(0, 500)
      });
      res.status(500).json({ message: error.message || "Kunne ikke sende besked" });
    }
  });

  // Check for new emails
  app.post("/api/emails/check-inbox", async (req, res) => {
    try {
      const stats = await emailService.checkInbox();
      res.json({ 
        message: `Fandt ${stats.messagesFound} emails, processerede ${stats.messagesProcessed}, oprettede ${stats.newDocuments} nye dokumenter`,
        stats 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Debug endpoint for email tracking
  app.get("/api/debug/email-tracking", async (req, res) => {
    try {
      const threads = await storage.getUserEmailThreads(req.query.userId as string || '');
      
      const debugInfo = await Promise.all(
        threads.map(async (thread) => {
          const emails = await storage.getThreadEmails(thread.id);
          const company = thread.companyId ? await storage.getCompany(thread.companyId) : null;
          
          return {
            thread: {
              id: thread.id,
              subject: thread.subject,
              status: thread.status,
              gmailThreadId: thread.threadId,
              requestToken: thread.requestToken || 'NOT SET',
              replyToEmail: thread.replyToEmail || 'NOT SET',
              createdAt: thread.createdAt
            },
            company: company ? { name: company.name, email: company.email } : null,
            emailCount: {
              total: emails.length,
              outbound: emails.filter(e => e.direction === 'outbound').length,
              inbound: emails.filter(e => e.direction === 'inbound').length,
              auto: emails.filter(e => e.direction === 'auto').length
            },
            emails: emails.map(e => ({
              id: e.id,
              direction: e.direction,
              subject: e.subject,
              sentAt: e.sentAt,
              hasAttachments: Array.isArray(e.attachments) && e.attachments.length > 0
            }))
          };
        })
      );

      // Get real Gmail scope info
      const gmailStatus = gmailOAuthService.getConnectionStatus();
      const tokens = gmailOAuthService.getTokens();
      const scopeString = tokens && typeof tokens === 'object' && 'scope' in tokens 
        ? (tokens as any).scope 
        : 'Unknown';
      
      const hasReadPermission = scopeString.includes('gmail.readonly') || scopeString.includes('gmail.modify');
      
      res.json({
        totalThreads: threads.length,
        gmailScopes: {
          hasReadPermission: hasReadPermission ? '✅ Granted' : '❌ MISSING - Need gmail.readonly or gmail.modify scope',
          currentScopes: scopeString,
          configured: gmailStatus.configured,
          authorized: gmailStatus.authorized
        },
        threads: debugInfo
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message, stack: error.stack });
    }
  });

  // Gmail OAuth routes
  app.get("/auth/gmail", async (req, res) => {
    try {
      const authUrl = gmailOAuthService.getAuthUrl();
      res.redirect(authUrl);
    } catch (error: any) {
      res.status(500).json({ 
        message: "OAuth not configured", 
        error: error.message,
        instructions: "Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in Replit Secrets"
      });
    }
  });

  app.get("/auth/gmail/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        return res.status(400).send("No authorization code received");
      }

      const tokens = await gmailOAuthService.handleCallback(code);
      
      // Return success page with instructions to save tokens
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Gmail Connected - BedreTilbud</title>
            <style>
              body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
              .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 20px; border-radius: 8px; }
              .code-block { background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; border-radius: 4px; font-family: monospace; white-space: pre; overflow-x: auto; }
              .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 8px; margin-top: 20px; }
              h1 { color: #155724; }
              .btn { background: #28a745; color: white; padding: 10px 20px; border-radius: 4px; text-decoration: none; display: inline-block; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="success">
              <h1>✅ Gmail Connected Successfully!</h1>
              <p>Your Gmail account has been authorized with full inbox permissions.</p>
            </div>

            <div class="warning">
              <h2>⚠️ Important: Save Your Tokens</h2>
              <p>Add the following to your Replit Secrets to persist the connection:</p>
              <p><strong>Secret Name:</strong> GMAIL_TOKENS</p>
              <p><strong>Secret Value (copy this exactly):</strong></p>
              <div class="code-block">${JSON.stringify(tokens, null, 2)}</div>
              
              <p style="margin-top: 20px;">
                <strong>Steps:</strong>
                <ol>
                  <li>Go to Replit Tools → Secrets</li>
                  <li>Create a new secret named: <code>GMAIL_TOKENS</code></li>
                  <li>Paste the JSON above as the value</li>
                  <li>Save the secret</li>
                  <li>Restart your app</li>
                </ol>
              </p>
            </div>

            <a href="/" class="btn">Back to Dashboard</a>
          </body>
        </html>
      `);
    } catch (error: any) {
      res.status(500).send(`
        <h1>Error</h1>
        <p>${error.message}</p>
        <a href="/auth/gmail">Try Again</a>
      `);
    }
  });

  app.get("/api/gmail/status", async (req, res) => {
    const status = gmailOAuthService.getConnectionStatus();
    res.json(status);
  });

  // Comparison routes
  app.get("/api/comparisons/user/:userId", requireAuth, async (req, res) => {
    try {
      // Pagination support
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      const allComparisons = await storage.getUserComparisons(req.params.userId);
      const totalCount = allComparisons.length;
      const comparisons = allComparisons.slice(offset, offset + limit);
      
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

      res.json({
        data: enrichedComparisons,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: offset + limit < totalCount
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/comparisons/:id", requireAuth, async (req, res) => {
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

  // Regenerate comparison
  app.post("/api/comparisons/:id/regenerate", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { comparisons: comparisonsTable } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const comparison = await storage.getComparison(req.params.id);
      if (!comparison) {
        return res.status(404).json({ message: "Comparison not found" });
      }

      const currentDoc = await storage.getDocument(comparison.currentDocumentId ?? '');
      const offerDoc = await storage.getDocument(comparison.offerDocumentId ?? '');
      const user = await storage.getUser(comparison.userId ?? '');

      if (!currentDoc || !offerDoc || !currentDoc.ocrData || !offerDoc.ocrData) {
        return res.status(400).json({ message: "Missing OCR data for comparison" });
      }

      console.log('[Regenerate] Generating new comparison for:', {
        comparisonId: comparison.id,
        currentDoc: currentDoc.fileName,
        offerDoc: offerDoc.fileName
      });

      const newComparisonData = await comparisonService.compareInsurancePolicies(
        currentDoc.ocrData as any,
        offerDoc.ocrData as any,
        user ? {
          housingType: user.housingType ?? undefined,
          hasCar: user.hasCar ?? undefined,
          deductible: user.deductible ?? undefined,
          additionalInfo: user.additionalInfo ?? undefined
        } : undefined
      );

      const aiRecommendation = newComparisonData.verdict === 'recommended' 
        ? 'Vi anbefaler dette tilbud - det giver dig bedre dækning til en lavere pris.'
        : newComparisonData.verdict === 'not_recommended'
        ? 'Vi anbefaler ikke dette tilbud - dit nuværende forsikring er bedre.'
        : 'Dette tilbud kan være interessant - gennemgå fordele og ulemper nøje.';

      await db
        .update(comparisonsTable)
        .set({
          comparisonData: newComparisonData,
          aiRecommendation,
          savings: Math.round(newComparisonData.savings || 0)
        })
        .where(eq(comparisonsTable.id, req.params.id));

      const updatedComparison = await storage.getComparison(req.params.id);

      res.json({
        ...updatedComparison,
        currentDocument: currentDoc,
        offerDocument: offerDoc,
        company: comparison.companyId ? await storage.getCompany(comparison.companyId) : null
      });
    } catch (error: any) {
      console.error('[Regenerate] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Send missing info questions to company
  app.post("/api/comparisons/:id/send-questions", async (req, res) => {
    try {
      const { questionIds } = req.body;
      
      if (!Array.isArray(questionIds) || questionIds.length === 0) {
        return res.status(400).json({ message: "No questions selected" });
      }

      const comparison = await storage.getComparison(req.params.id);
      if (!comparison) {
        return res.status(404).json({ message: "Comparison not found" });
      }

      const comparisonData = comparison.comparisonData as any;
      if (!comparisonData?.missingInfo?.categories) {
        return res.status(400).json({ message: "No missing info available" });
      }

      // Extract selected questions
      const allQuestions: any[] = [];
      comparisonData.missingInfo.categories.forEach((cat: any) => {
        cat.questions.forEach((q: any) => {
          if (questionIds.includes(q.id)) {
            allQuestions.push(q);
          }
        });
      });

      if (allQuestions.length === 0) {
        return res.status(400).json({ message: "Selected questions not found" });
      }

      const company = comparison.companyId ? await storage.getCompany(comparison.companyId) : null;
      if (!company) {
        return res.status(400).json({ message: "Company not found" });
      }

      // Generate email
      const emailBody = await comparisonService.generateMissingInfoEmail(
        company.name,
        allQuestions
      );

      // Send email through thread
      const thread = await storage.getEmailThreadByCompany(comparison.userId!, comparison.companyId!);
      if (!thread) {
        return res.status(400).json({ message: "Email thread not found" });
      }

      const email = await emailService.sendFollowUpEmail(
        thread.id,
        emailBody,
        questionIds // Store question IDs with the email
      );

      res.json({ 
        success: true, 
        message: `Sendte ${allQuestions.length} spørgsmål til ${company.name}`,
        emailId: email.id
      });
    } catch (error: any) {
      console.error('[Missing Info] Error sending questions:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add custom question to comparison
  app.post("/api/comparisons/:id/add-custom-question", async (req, res) => {
    try {
      const { question } = req.body;
      
      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return res.status(400).json({ message: "Spørgsmål skal udfyldes" });
      }

      const comparison = await storage.getComparison(req.params.id);
      if (!comparison) {
        return res.status(404).json({ message: "Comparison not found" });
      }

      const comparisonData = comparison.comparisonData as any;
      if (!comparisonData?.missingInfo) {
        comparisonData.missingInfo = {
          totalCritical: 0,
          totalImportant: 0,
          totalQuestions: 0,
          categories: []
        };
      }

      // Find or create "Andet" category
      let andetCategory = comparisonData.missingInfo.categories.find((cat: any) => cat.name === "Andet");
      
      if (!andetCategory) {
        andetCategory = {
          name: "Andet",
          icon: "help-circle",
          iconVariant: "neutral",
          criticalCount: 0,
          importantCount: 0,
          questionCount: 0,
          questions: []
        };
        comparisonData.missingInfo.categories.push(andetCategory);
      }

      // Generate unique ID for the custom question
      const customQuestionId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Add custom question to Andet category
      const customQuestion = {
        id: customQuestionId,
        question: question.trim(),
        explanation: "Brugerdefineret spørgsmål",
        severity: "question",
        category: "Andet",
        categoryIcon: "help-circle"
      };

      andetCategory.questions.push(customQuestion);
      andetCategory.questionCount++;
      comparisonData.missingInfo.totalQuestions++;

      // Update comparison in database
      const { db } = await import("./db");
      const { comparisons: comparisonsTable } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      await db
        .update(comparisonsTable)
        .set({ comparisonData })
        .where(eq(comparisonsTable.id, req.params.id));

      const updatedComparison = await storage.getComparison(req.params.id);

      res.json({ 
        success: true, 
        message: "Spørgsmål tilføjet",
        questionId: customQuestionId,
        comparison: updatedComparison
      });
    } catch (error: any) {
      console.error('[Custom Question] Error adding question:', error);
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

  // Household Members routes
  app.get("/api/household-members/:userId", async (req, res) => {
    try {
      const members = await storage.getUserHouseholdMembers(req.params.userId);
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/household-members", async (req, res) => {
    try {
      const { insertHouseholdMemberSchema } = await import("@shared/schema");
      const memberData = insertHouseholdMemberSchema.parse(req.body);
      const member = await storage.createHouseholdMember(memberData);
      res.json(member);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/household-members/:id", async (req, res) => {
    try {
      const { insertHouseholdMemberSchema } = await import("@shared/schema");
      const updates = insertHouseholdMemberSchema.partial().parse(req.body);
      const member = await storage.updateHouseholdMember(req.params.id, updates);
      res.json(member);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/household-members/:id", async (req, res) => {
    try {
      await storage.deleteHouseholdMember(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

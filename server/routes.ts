import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { mistralOcrService as ocrService } from "./services/mistralOcrService";
import { comparisonService } from "./services/comparisonService";
import { insuranceCheckService } from "./services/insuranceCheckService";
import { emailService } from "./services/emailService";
import { gmailOAuthService } from "./services/gmailOAuthService";
import { PolicyMatchingService } from "./services/policyMatchingService";
import { policyComparisonService } from "./services/policySnapshots/PolicyComparisonService";
import { requireAuth, requireOwnership } from "./middleware/auth";
import { validateFileUpload } from "./middleware/uploadValidation";
import { uploadLimiter, emailLimiter, aiLimiter } from "./middleware/rateLimiting";
import { generateCSRFToken, requireCSRFToken } from "./middleware/csrf";
import { apiCaching, noCache } from "./middleware/caching";
import { generateSignedUrl, validateSignedUrl } from "./utils/signedUrls";
import { logger, auditLog } from "./utils/logging";
import { calculateFileChecksum, validatePDFFile, scanFileForMalware } from "./utils/fileValidation";
import { convertToPolicyRecord } from "./utils/policyExtractionParser";
import multer from "multer";
import path from "path";
import fs from "fs";
import { insertUserSchema, insertDocumentSchema, type Document as DocumentType, type Comparison, type CompanyComparison } from "@shared/schema";
import { z } from "zod";
import * as validationSchemas from "./validation/schemas";

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
  // Instantiate shared service instances
  const policyMatchingService = new PolicyMatchingService(storage, comparisonService);
  
  // Health check endpoints
  // CSRF token endpoint
  app.get("/api/csrf-token", requireAuth, noCache, async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const token = generateCSRFToken(userId);
      res.json({ csrfToken: token });
    } catch (error: any) {
      logger.error('Failed to generate CSRF token', error, { userId: req.headers['x-user-id'] as string });
      res.status(500).json({ message: error.message });
    }
  });

  // Signed URL file download endpoint
  app.get("/api/files/download", async (req, res) => {
    try {
      const { path: filePath, userId, expires, signature } = req.query as Record<string, string>;
      
      // Validate signed URL
      const validation = validateSignedUrl(filePath, userId, expires, signature);
      if (!validation.valid) {
        logger.security('Invalid signed URL attempt', { filePath, userId, reason: validation.reason });
        return res.status(403).json({ message: validation.reason || 'Invalid URL' });
      }
      
      // Verify file exists and user has access
      const fullPath = path.join(process.cwd(), filePath);
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ message: 'File not found' });
      }
      
      // Send file
      logger.info('File downloaded via signed URL', { filePath, userId });
      res.download(fullPath);
    } catch (error: any) {
      logger.error('File download failed', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/health", apiCaching(60), async (req, res) => {
    res.status(200).json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  app.get("/ready", noCache, async (req, res) => {
    const checks: Record<string, { status: string; message?: string }> = {};
    let allHealthy = true;

    try {
      // 1. Check required environment variables
      const requiredEnvVars = ['OPENAI_API_KEY', 'MISTRAL_API_KEY', 'DATABASE_URL'];
      const missingVars = requiredEnvVars.filter(v => !process.env[v]);
      
      if (missingVars.length > 0) {
        checks.environment = { status: "fail", message: `Missing: ${missingVars.join(', ')}` };
        allHealthy = false;
      } else {
        checks.environment = { status: "ok" };
      }
      
      // 2. Check database connection
      try {
        const { db } = await import("./db");
        const { sql } = await import("drizzle-orm");
        await db.execute(sql`SELECT 1`);
        checks.database = { status: "ok" };
      } catch (dbError: any) {
        checks.database = { status: "fail", message: dbError.message };
        allHealthy = false;
      }
      
      // 3. Check database connection pool
      try {
        const { pool } = await import("./db");
        const totalClients = pool.totalCount;
        const idleClients = pool.idleCount;
        const waitingClients = pool.waitingCount;
        checks.connectionPool = { 
          status: totalClients < 20 ? "ok" : "warn",
          message: `Total: ${totalClients}, Idle: ${idleClients}, Waiting: ${waitingClients}`
        };
      } catch (poolError: any) {
        checks.connectionPool = { status: "warn", message: poolError.message };
      }
      
      // 4. Check Gmail API availability
      try {
        const gmailStatus = gmailOAuthService.getConnectionStatus();
        if (gmailStatus.configured && gmailStatus.authorized) {
          checks.gmail = { status: "ok", message: "Connected" };
        } else {
          checks.gmail = { status: "warn", message: "Not connected - features limited" };
        }
      } catch (gmailError: any) {
        checks.gmail = { status: "warn", message: gmailError.message };
      }
      
      // Return health status
      const statusCode = allHealthy ? 200 : 503;
      res.status(statusCode).json({ 
        status: allHealthy ? "ready" : "degraded",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks
      });
    } catch (error: any) {
      res.status(503).json({ 
        status: "not_ready", 
        error: error.message,
        checks
      });
    }
  });

  app.get("/metrics", requireAuth, noCache, async (req, res) => {
    try {
      const { performanceMonitor } = await import("./utils/performanceMonitor");
      const { apiCache } = await import("./utils/cache");
      
      const metrics = performanceMonitor.getMetrics();
      const cacheSize = apiCache.size();
      
      res.json({
        ...metrics,
        cacheSize,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // User routes
  app.get("/api/users/check/:email", async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email);
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ exists: false });
      }
      res.json({ exists: true, user });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get all users with pagination
  app.get("/api/users", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      
      // Pagination support
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;
      
      // Get total count for pagination
      const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
      const totalCount = allUsers.length;
      
      // Apply pagination
      const paginatedUsers = allUsers.slice(offset, offset + limit);
      
      res.json({
        data: paginatedUsers,
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

  app.get("/api/users/:id", requireAuth, requireOwnership, apiCaching(60), async (req, res) => {
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

  // Navigation data endpoint
  app.get("/api/nav-data/:userId", requireAuth, requireOwnership, apiCaching(30), async (req, res) => {
    try {
      const navData = await storage.getNavigationData(req.params.userId);
      res.json(navData);
    } catch (error: any) {
      logger.error('Failed to fetch navigation data', error, { userId: req.params.userId });
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

  app.post("/api/users/:id/password", requireAuth, requireOwnership, requireCSRFToken, async (req, res) => {
    try {
      const bcrypt = await import("bcrypt");
      const { currentPassword, newPassword } = validationSchemas.updatePasswordSchema.parse(req.body);
      
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.passwordHash) {
        const isValid = await bcrypt.compare(currentPassword || '', user.passwordHash);
        if (!isValid) {
          auditLog('password_change_failed', req.params.id, 'Invalid current password');
          return res.status(401).json({ message: "Current password is incorrect" });
        }
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      const updatedUser = await storage.updateUser(req.params.id, { passwordHash });
      
      auditLog('password_changed', req.params.id, 'Password updated successfully');
      res.json({ message: "Password updated successfully" });
    } catch (error: any) {
      logger.error('Password update failed', error, { userId: req.params.id });
      res.status(400).json({ message: error.message });
    }
  });

  // Onboarding Progress routes
  app.get("/api/onboarding/progress/:email", async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email);
      let progress = await storage.getOnboardingProgressByEmail(email);
      if (!progress) {
        return res.status(404).json({ message: "No onboarding progress found for this email" });
      }
      
      if (!progress.userId) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          logger.info('Auto-linking existing user to onboarding progress', { email, userId: existingUser.id });
          progress = await storage.updateOnboardingProgress(email, { userId: existingUser.id });
        }
      }
      
      res.json(progress);
    } catch (error: any) {
      logger.error('Failed to fetch onboarding progress', error, { email: req.params.email });
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/onboarding/progress", async (req, res) => {
    try {
      const { insertOnboardingProgressSchema } = await import("@shared/schema");
      const progressData = insertOnboardingProgressSchema.parse(req.body);
      const progress = await storage.createOnboardingProgress(progressData);
      logger.info('Onboarding progress created', { email: progress.email });
      res.json(progress);
    } catch (error: any) {
      logger.error('Failed to create onboarding progress', error);
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/onboarding/progress/:email", async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email);
      const { insertOnboardingProgressSchema } = await import("@shared/schema");
      const updates = insertOnboardingProgressSchema.partial().parse(req.body);
      const progress = await storage.updateOnboardingProgress(email, updates);
      logger.info('Onboarding progress updated', { email: progress.email, currentStep: progress.currentStep });
      res.json(progress);
    } catch (error: any) {
      logger.error('Failed to update onboarding progress', error, { email: req.params.email });
      res.status(400).json({ message: error.message });
    }
  });

  // Company routes
  app.get("/api/companies", apiCaching(300), async (req, res) => {
    try {
      const companies = await storage.getActiveCompanies();
      res.json(companies);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Document upload routes
  app.post("/api/documents/upload", uploadLimiter, requireAuth, requireCSRFToken, upload.array('files'), validateFileUpload, async (req, res) => {
    try {
      const { userId, documentType = 'current' } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const documentsWithPolicies = [];

      for (const file of files) {
        let document;
        let matchResult = null;
        
        try {
          // NEW 2-STEP PIPELINE (v2.1.0): Create document first, then run orchestrator
          logger.info('[Upload] Starting new 2-step extraction pipeline', { 
            fileName: file.originalname, 
            userId 
          });
          
          // Create document placeholder (orchestrator will populate OCR data)
          document = await storage.createDocument({
            userId,
            fileName: file.originalname,
            filePath: file.path,
            fileSize: file.size,
            ocrRawResponse: null, // Will be populated by orchestrator
            extractionStatus: 'processing',
            documentType,
            companyId: documentType === 'offer' ? req.body.companyId : undefined
          });

          logger.info('[Upload] Document created, running extraction orchestrator', { 
            documentId: document.id
          });

          // Run NEW extraction pipeline (OCR → Segmentation → Per-segment Extraction)
          const { ExtractionOrchestratorService } = await import('./services/extractionOrchestratorService');
          const orchestrator = new ExtractionOrchestratorService(storage);
          const orchestratorResult = await orchestrator.processDocument(document.id);
          
          if (!orchestratorResult.success) {
            throw new Error(orchestratorResult.error || 'Extraction pipeline failed');
          }

          logger.info('[Upload] Extraction pipeline completed', {
            documentId: document.id,
            snapshotsCreated: orchestratorResult.snapshots.length,
            pipelineVersion: '2.1.0',
            stages: orchestratorResult.stages.map(s => `${s.name}:${s.status}`)
          });

          // Create legacy policies from OfferSnapshots for backward compatibility
          const createdPolicies = [];
          for (const snapshot of orchestratorResult.snapshots) {
            const policyRecord = {
              userId,
              documentId: document.id,
              policyType: snapshot.policyType,
              premium: snapshot.premium || null, // Already a string from DB
              deductible: snapshot.deductible || null, // Already a string from DB
              coverageDetails: snapshot.coverageDetails as any, // JSON from DB
              companyId: snapshot.companyId || (documentType === 'offer' ? req.body.companyId : undefined)
            };

            const savedPolicy = await storage.createPolicy(policyRecord);
            createdPolicies.push(savedPolicy);

            logger.info('[Upload] Legacy policy created from snapshot', { 
              policyId: savedPolicy.id, 
              type: savedPolicy.policyType,
              snapshotId: snapshot.id
            });
          }

          // LEGACY SYSTEM DISABLED: Old policy matching removed in favor of new Phase 3→4 pipeline
          // The new ComparisonOrchestrator runs after health checks complete (see below)

          // Run HealthCheckOrchestrator for ALL documents (current + offer)
          // This creates health_checks table records for frontend consumption
          const { HealthCheckOrchestrator } = await import('./services/healthCheckOrchestrator');
          const healthCheckOrchestrator = new HealthCheckOrchestrator(storage);
          
          const healthCheckSource = documentType === 'offer' ? 'offer_upload' : 'current_upload';
          const healthCheckResult = await healthCheckOrchestrator.runForDocument(
            document.id,
            {
              source: healthCheckSource,
              userId,
              forceRerun: false
            }
          );

          logger.info('[Upload] Health check orchestration completed', {
            documentId: document.id,
            source: healthCheckSource,
            success: healthCheckResult.success,
            healthChecksCreated: healthCheckResult.healthChecksCreated,
            healthChecksFailed: healthCheckResult.healthChecksFailed,
            skipped: healthCheckResult.skipped
          });

          // Legacy: Also update policies table for backward compatibility
          const healthCheckPromises = createdPolicies.map(async (policy) => {
            try {
              logger.info('[Upload] Updating legacy policy health check', { 
                policyId: policy.id 
              });
              
              const healthCheckResult = await insuranceCheckService.analyzeInsuranceHealth(policy);

              // Update policy with health check data (legacy support)
              await storage.updatePolicyHealthCheck(policy.id, {
                status: 'completed',
                payload: healthCheckResult,
                savingsAnnual: healthCheckResult.annualSavings?.amount || 0
              });

              return { policyId: policy.id, success: true };
            } catch (error: any) {
              logger.error('[Upload] Legacy health check update failed for policy', error instanceof Error ? error : new Error(String(error)), { 
                policyId: policy.id 
              });
              
              // Mark as failed but don't throw
              await storage.updatePolicyHealthCheck(policy.id, {
                status: 'failed',
                payload: { error: 'Health check failed' },
                savingsAnnual: 0
              });

              return { policyId: policy.id, success: false, error: error instanceof Error ? error.message : 'Unknown error' };
            }
          });

          await Promise.all(healthCheckPromises);

          // NEW: Run ComparisonOrchestrator for offer documents (Phase 3→4 pipeline)
          // This runs AFTER health checks complete (required for Phase 2 data)
          if (documentType === 'offer' && healthCheckResult.success && healthCheckResult.healthChecksCreated > 0) {
            try {
              logger.info('[Upload] Triggering new comparison pipeline for offer', {
                documentId: document.id,
                userId,
                healthChecksCreated: healthCheckResult.healthChecksCreated
              });

              const { ComparisonOrchestrator } = await import('./services/comparisonOrchestrator');
              const comparisonOrchestrator = new ComparisonOrchestrator(storage);
              
              const comparisonResult = await comparisonOrchestrator.runForUser({
                userId,
                forceRerun: false
              });

              logger.info('[Upload] Comparison pipeline completed', {
                documentId: document.id,
                comparisonsCreated: comparisonResult.comparisonsCreated,
                comparisonsFailed: comparisonResult.comparisonsFailed,
                skipped: comparisonResult.skipped,
                skipReason: comparisonResult.skipReason
              });

            } catch (comparisonError: any) {
              logger.error('[Upload] Comparison pipeline failed', comparisonError instanceof Error ? comparisonError : new Error(String(comparisonError)), {
                documentId: document.id,
                userId
              });
              // Don't fail the upload if comparison fails - user can manually trigger later
            }
          }

          // Update document with completed status AND ocrData for backward compatibility
          // Create ocrData from first snapshot for analyze endpoint compatibility
          const firstSnapshot = orchestratorResult.snapshots.length > 0 ? orchestratorResult.snapshots[0] : null;
          const ocrData = firstSnapshot ? {
            type: firstSnapshot.policyType,
            company: firstSnapshot.companyId,
            premium: firstSnapshot.premium ? parseFloat(firstSnapshot.premium) : null,
            deductible: firstSnapshot.deductible ? parseFloat(firstSnapshot.deductible) : null,
            coverages: firstSnapshot.coverageDetails
          } : null;

          await storage.updateDocument(document.id, {
            extractionStatus: 'completed',
            totalPoliciesExtracted: orchestratorResult.snapshots.length,
            ocrData // Populate ocrData for analyze endpoint compatibility
          });

          logger.info('[Upload] Document processing completed', { 
            documentId: document.id, 
            policiesExtracted: orchestratorResult.snapshots.length 
          });

          documentsWithPolicies.push({
            document,
            policies: createdPolicies,
            healthChecksCreated: healthCheckResult.healthChecksCreated,
            healthChecksFailed: healthCheckResult.healthChecksFailed
          });

        } catch (error: any) {
          logger.error('[Upload] OCR extraction failed', error, { fileName: file.originalname });
          
          // If document was created, mark as failed
          if (document) {
            await storage.updateDocument(document.id, {
              extractionStatus: 'failed'
            });
          }

          // Continue to next file instead of failing entire upload
          documentsWithPolicies.push({
            document: document || null,
            error: error.message,
            policies: []
          });
        }
      }

      res.json(documentsWithPolicies);
    } catch (error: any) {
      logger.error('[Upload] Upload route failed', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/documents/user/:userId", requireAuth, async (req, res) => {
    try {
      const { documentType } = req.query;
      
      // Pagination support
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;
      
      // Get total count efficiently without loading all documents
      const totalCount = await storage.countUserDocuments(
        req.params.userId,
        documentType as string
      );
      
      // Get paginated results
      const paginatedDocuments = await storage.getUserDocuments(
        req.params.userId,
        documentType as string,
        limit,
        offset
      );
      
      res.json({
        data: paginatedDocuments,
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

  app.get("/api/documents/:id/extraction-stages", requireAuth, async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      
      // 404 if document doesn't exist
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // 409 if extraction is in-progress (any state other than completed or failed)
      const terminalStates = ['completed', 'failed'];
      if (document.extractionStatus && !terminalStates.includes(document.extractionStatus)) {
        return res.status(409).json({ 
          message: "Extraction pipeline is currently running for this document",
          status: document.extractionStatus
        });
      }
      
      // 204 if document exists but has no extraction_stages yet
      if (!document.extractionStages) {
        return res.status(204).send();
      }
      
      // Extract validation errors from stage3 metadata if present
      const stages = document.extractionStages as any;
      const validationErrors = stages?.stage3_extraction?.metadata?.errors || [];
      
      // Return document context + extraction stages with validation structure
      res.json({
        documentId: document.id,
        fileName: document.fileName,
        createdAt: document.createdAt,
        totalPoliciesExtracted: document.totalPoliciesExtracted || 0,
        validation: {
          status: document.extractionStatus || 'unknown',
          errors: validationErrors
        },
        stages: document.extractionStages
      });
    } catch (error: any) {
      logger.error('[Extraction Stages] Failed to fetch extraction stages', error, { 
        documentId: req.params.id 
      });
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/documents/:id", requireAuth, requireCSRFToken, async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const userId = req.headers['x-user-id'] as string;
      if (document.userId !== userId) {
        auditLog('unauthorized_document_delete_attempt', userId, `Attempted to delete document ${req.params.id}`);
        return res.status(403).json({ message: "Unauthorized" });
      }

      // CASCADE DELETE: First delete all policies associated with this document
      const relatedPolicies = await storage.getPoliciesByDocument(req.params.id);
      logger.info('[Document Delete] Deleting related policies', { 
        documentId: req.params.id, 
        policyCount: relatedPolicies.length 
      });
      
      for (const policy of relatedPolicies) {
        await storage.deletePolicy(policy.id);
        logger.info('[Document Delete] Policy deleted', { policyId: policy.id, policyType: policy.policyType });
      }

      // Delete the physical file
      if (document.filePath && fs.existsSync(document.filePath)) {
        fs.unlinkSync(document.filePath);
      }

      // Finally delete the document record
      await storage.deleteDocument(req.params.id);
      auditLog('document_deleted', userId, `Deleted document: ${document.fileName} with ${relatedPolicies.length} policies`);
      
      res.status(204).send();
    } catch (error: any) {
      logger.error('Document deletion failed', error, { documentId: req.params.id });
      res.status(500).json({ message: error.message });
    }
  });

  // Migrate documents with OfferSnapshots but no Policies
  app.post("/api/documents/migrate-snapshots/:userId", requireAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { documents: documentsTable, offerSnapshots: snapshotsTable, policies: policiesTable } = await import("@shared/schema");
      const { eq, sql, inArray } = await import("drizzle-orm");

      const userId = req.params.userId;

      // Find documents with OfferSnapshots but no Policies
      const documentsWithSnapshots = await db
        .select({ documentId: snapshotsTable.documentId })
        .from(snapshotsTable)
        .where(eq(snapshotsTable.userId, userId))
        .groupBy(snapshotsTable.documentId);

      const documentIds = documentsWithSnapshots.map(d => d.documentId).filter(Boolean) as string[];

      if (documentIds.length === 0) {
        return res.json({ message: 'No documents with snapshots found', migratedDocuments: [] });
      }

      // Find which documents have NO policies
      const documentsWithPolicies = await db
        .select({ documentId: policiesTable.documentId })
        .from(policiesTable)
        .where(inArray(policiesTable.documentId, documentIds))
        .groupBy(policiesTable.documentId);

      const documentIdsWithPolicies = documentsWithPolicies.map(d => d.documentId);
      const documentIdsToMigrate = documentIds.filter(id => !documentIdsWithPolicies.includes(id));

      console.log(`[Migration] Found ${documentIdsToMigrate.length} documents needing migration`);

      const migratedDocs = [];

      for (const documentId of documentIdsToMigrate) {
        try {
          // Get document info
          const document = await db
            .select()
            .from(documentsTable)
            .where(eq(documentsTable.id, documentId))
            .limit(1);

          if (document.length === 0) continue;

          const doc = document[0];

          // Get all snapshots for this document
          const snapshots = await db
            .select()
            .from(snapshotsTable)
            .where(eq(snapshotsTable.documentId, documentId));

          console.log(`[Migration] Creating ${snapshots.length} policies for document ${doc.fileName}`);

          const createdPolicies = [];
          for (const snapshot of snapshots) {
            const policyRecord = {
              userId,
              documentId: doc.id,
              policyType: snapshot.policyType,
              premium: snapshot.premium || null,
              deductible: snapshot.deductible || null,
              coverageDetails: snapshot.coverageDetails as any,
              companyId: snapshot.companyId || doc.companyId
            };

            const savedPolicy = await storage.createPolicy(policyRecord);
            createdPolicies.push(savedPolicy);

            console.log(`[Migration] Policy created from snapshot`, { 
              policyId: savedPolicy.id, 
              type: savedPolicy.policyType
            });
          }

          // Run health checks for current documents
          if (doc.documentType === 'current' && createdPolicies.length > 0) {
            console.log(`[Migration] Running health checks for ${createdPolicies.length} policies`);
            
            const healthCheckPromises = createdPolicies.map(async (policy) => {
              try {
                const healthCheckResult = await insuranceCheckService.analyzeInsuranceHealth(policy);
                await storage.updatePolicyHealthCheck(policy.id, {
                  status: 'completed',
                  payload: healthCheckResult,
                  savingsAnnual: healthCheckResult.annualSavings?.amount || 0
                });
                console.log(`[Migration] Health check completed for policy ${policy.id}`);
                return { policyId: policy.id, success: true };
              } catch (error) {
                console.error(`[Migration] Health check failed for policy ${policy.id}:`, error);
                return { policyId: policy.id, success: false };
              }
            });

            const healthCheckResults = await Promise.all(healthCheckPromises);
            const successCount = healthCheckResults.filter(r => r.success).length;
            console.log(`[Migration] Health checks completed: ${successCount}/${createdPolicies.length} successful`);
          }

          migratedDocs.push({ 
            id: doc.id, 
            fileName: doc.fileName, 
            status: 'success',
            policiesCreated: createdPolicies.length
          });
        } catch (error: any) {
          console.error(`[Migration] Failed to migrate document ${documentId}:`, error);
          migratedDocs.push({ id: documentId, status: 'failed', error: error.message });
        }
      }

      res.json({
        message: `Migrated ${migratedDocs.length} documents`,
        migratedDocuments: migratedDocs
      });
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
          console.log(`[Reprocess] Processing document with new 2-step pipeline: ${doc.fileName}`);
          
          // Run NEW extraction pipeline (OCR → Segmentation → Per-segment Extraction)
          const { ExtractionOrchestratorService } = await import('./services/extractionOrchestratorService');
          const orchestrator = new ExtractionOrchestratorService(storage);
          const orchestratorResult = await orchestrator.processDocument(doc.id);
          
          if (!orchestratorResult.success) {
            throw new Error(orchestratorResult.error || 'Extraction pipeline failed');
          }
          
          console.log(`[Reprocess] Extraction completed: ${orchestratorResult.snapshots.length} policies found`);
          
          // Update document with completed status
          await db
            .update(documentsTable)
            .set({ 
              extractionStatus: 'completed',
              totalPoliciesExtracted: orchestratorResult.snapshots.length
            })
            .where(eq(documentsTable.id, doc.id));

          // Create legacy policies from OfferSnapshots
          const createdPolicies = [];
          if (!doc.userId) {
            console.error(`[Reprocess] Document ${doc.id} has no userId, skipping policy creation`);
          } else {
            for (const snapshot of orchestratorResult.snapshots) {
              const policyRecord = {
                userId: doc.userId,
                documentId: doc.id,
                policyType: snapshot.policyType,
                premium: snapshot.premium || null,
                deductible: snapshot.deductible || null,
                coverageDetails: snapshot.coverageDetails as any,
                companyId: snapshot.companyId || doc.companyId
              };

              const savedPolicy = await storage.createPolicy(policyRecord);
              createdPolicies.push(savedPolicy);

              console.log(`[Reprocess] Legacy policy created from snapshot`, { 
                policyId: savedPolicy.id, 
                type: savedPolicy.policyType,
                snapshotId: snapshot.id
              });
            }
          }

          // Run health checks for current documents
          if (doc.documentType === 'current' && createdPolicies.length > 0) {
            console.log(`[Reprocess] Running health checks for ${createdPolicies.length} policies`);
            
            const healthCheckPromises = createdPolicies.map(async (policy) => {
              try {
                const healthCheckResult = await insuranceCheckService.analyzeInsuranceHealth(policy);
                await storage.updatePolicyHealthCheck(policy.id, {
                  status: 'completed',
                  payload: healthCheckResult,
                  savingsAnnual: healthCheckResult.annualSavings?.amount || 0
                });
                console.log(`[Reprocess] Health check completed for policy ${policy.id}`);
                return { policyId: policy.id, success: true };
              } catch (error) {
                console.error(`[Reprocess] Health check failed for policy ${policy.id}:`, error);
                return { policyId: policy.id, success: false };
              }
            });

            const healthCheckResults = await Promise.all(healthCheckPromises);
            const successCount = healthCheckResults.filter(r => r.success).length;
            console.log(`[Reprocess] Health checks completed: ${successCount}/${createdPolicies.length} successful`);
          }

          reprocessedDocs.push({ 
            id: doc.id, 
            fileName: doc.fileName, 
            status: 'success', 
            policiesExtracted: orchestratorResult.snapshots.length,
            pipelineVersion: '2.1.0'
          });
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

  // Policy routes
  app.get("/api/policies/user/:userId", requireAuth, async (req, res) => {
    try {
      const userId = req.params.userId;
      
      // Check authentication
      const requestingUserId = req.headers['x-user-id'] as string;
      if (requestingUserId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Get all policies for user
      const policies = await storage.getPoliciesByUser(userId);

      // Group policies by type
      const grouped = {
        indbo: policies.filter(p => p.policyType === 'indbo'),
        ulykke: policies.filter(p => p.policyType === 'ulykke'),
        hus: policies.filter(p => p.policyType === 'hus'),
        bil: policies.filter(p => p.policyType === 'bil'),
        rejse: policies.filter(p => p.policyType === 'rejse'),
        other: policies.filter(p => p.policyType === 'other')
      };

      logger.info('[Policies] User policies retrieved', { 
        userId, 
        totalPolicies: policies.length,
        breakdown: {
          indbo: grouped.indbo.length,
          ulykke: grouped.ulykke.length,
          hus: grouped.hus.length,
          bil: grouped.bil.length,
          rejse: grouped.rejse.length,
          other: grouped.other.length
        }
      });

      res.json(grouped);
    } catch (error: any) {
      logger.error('[Policies] Failed to fetch user policies', error, { userId: req.params.userId });
      res.status(500).json({ message: error.message });
    }
  });

  // Policy Comparisons (new simplified architecture based on policy_snapshots)
  app.get("/api/policies/comparisons", requireAuth, async (req, res) => {
    try {
      // Get authenticated user ID from headers (set by requireAuth middleware)
      const userId = req.headers['x-user-id'] as string;
      
      // Validate userId exists
      if (!userId) {
        logger.warn('[PolicyComparisons] Missing user ID in authenticated request');
        return res.status(401).json({ message: "User not authenticated" });
      }

      logger.info('[PolicyComparisons] Fetching comparisons', { userId });

      // Get comparisons from PolicyComparisonService
      const comparisons = await policyComparisonService.getComparisonsForUser(userId);

      logger.info('[PolicyComparisons] Comparisons retrieved', { 
        userId, 
        comparisonCount: comparisons.length,
        policyTypes: comparisons.map(c => c.policyType)
      });

      res.json({ comparisons });
    } catch (error: any) {
      logger.error('[PolicyComparisons] Failed to fetch comparisons', error, { 
        userId: req.headers['x-user-id'] 
      });
      res.status(500).json({ message: "Failed to fetch policy comparisons" });
    }
  });

  app.post("/api/policies/:policyId/refresh", requireAuth, async (req, res) => {
    try {
      const policyId = req.params.policyId;
      
      // Get the policy
      const policy = await storage.getPolicy(policyId);
      if (!policy) {
        return res.status(404).json({ message: "Policy not found" });
      }

      // Check authentication
      const requestingUserId = req.headers['x-user-id'] as string;
      if (requestingUserId !== policy.userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      logger.info('[Policies] Refreshing health check', { policyId, userId: policy.userId });

      try {
        // Run health check
        logger.info('[AI Usage] OpenAI-gpt-4o-mini - insurance-health-check - Starting', { policyId });
        
        const healthCheckResult = await insuranceCheckService.analyzeInsuranceHealth(policy);
        
        logger.info('[AI Usage] OpenAI-gpt-4o-mini - insurance-health-check - Success', { 
          policyId,
          score: healthCheckResult.overallScore,
          savings: healthCheckResult.annualSavings?.amount || 0
        });

        // Update policy with new health check data
        const updatedPolicy = await storage.updatePolicyHealthCheck(policyId, {
          status: 'completed',
          payload: healthCheckResult,
          savingsAnnual: healthCheckResult.annualSavings?.amount || 0
        });

        logger.info('[Policies] Health check refreshed successfully', { policyId });

        res.json(updatedPolicy);
      } catch (error: any) {
        logger.error('[Policies] Health check refresh failed', error, { policyId });
        logger.info('[AI Usage] OpenAI-gpt-4o-mini - insurance-health-check - Failed', { policyId });

        // Update policy with failed status
        await storage.updatePolicyHealthCheck(policyId, {
          status: 'failed',
          payload: { error: 'Health check failed' },
          savingsAnnual: 0
        });

        res.status(500).json({ message: `Health check failed: ${error.message}` });
      }
    } catch (error: any) {
      logger.error('[Policies] Refresh endpoint failed', error, { policyId: req.params.policyId });
      res.status(500).json({ message: error.message });
    }
  });

  // Bulk refresh all policies for a user
  app.post("/api/policies/user/:userId/refresh-all", requireAuth, async (req, res) => {
    try {
      const userId = req.params.userId;
      
      // Check authentication
      const requestingUserId = req.headers['x-user-id'] as string;
      if (requestingUserId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Get all policies for user
      const policies = await storage.getPoliciesByUser(userId);
      
      if (policies.length === 0) {
        return res.json({ message: "No policies to refresh", refreshed: 0 });
      }

      logger.info('[Policies] Bulk refresh starting', { userId, policyCount: policies.length });

      // Refresh all policies in parallel
      const refreshPromises = policies.map(async (policy) => {
        try {
          logger.info('[AI Usage] OpenAI-gpt-4o-mini - insurance-health-check - Starting', { policyId: policy.id });
          
          const healthCheckResult = await insuranceCheckService.analyzeInsuranceHealth(policy);
          
          logger.info('[AI Usage] OpenAI-gpt-4o-mini - insurance-health-check - Success', { 
            policyId: policy.id,
            score: healthCheckResult.overallScore,
            savings: healthCheckResult.annualSavings?.amount || 0
          });

          await storage.updatePolicyHealthCheck(policy.id, {
            status: 'completed',
            payload: healthCheckResult,
            savingsAnnual: healthCheckResult.annualSavings?.amount || 0
          });

          return { policyId: policy.id, success: true };
        } catch (error: any) {
          logger.error('[Policies] Bulk refresh failed for policy', error, { policyId: policy.id });
          logger.info('[AI Usage] OpenAI-gpt-4o-mini - insurance-health-check - Failed', { policyId: policy.id });

          await storage.updatePolicyHealthCheck(policy.id, {
            status: 'failed',
            payload: { error: 'Health check failed' },
            savingsAnnual: 0
          });

          return { policyId: policy.id, success: false, error: error.message };
        }
      });

      const results = await Promise.all(refreshPromises);
      const successCount = results.filter(r => r.success).length;
      
      logger.info('[Policies] Bulk refresh complete', { 
        userId, 
        total: policies.length,
        succeeded: successCount,
        failed: policies.length - successCount
      });

      res.json({ 
        message: `Refreshed ${successCount} of ${policies.length} policies`,
        refreshed: successCount,
        total: policies.length,
        results
      });
    } catch (error: any) {
      logger.error('[Policies] Bulk refresh failed', error, { userId: req.params.userId });
      res.status(500).json({ message: error.message });
    }
  });

  // Offer Comparison routes (Sammenligning)
  app.get("/api/sammenligning/:userId/:companyId", requireAuth, requireOwnership, async (req, res) => {
    try {
      const { userId, companyId } = req.params;
      
      const comparisons = await storage.getComparisonsByUserAndCompany(userId, companyId);
      
      if (comparisons.length === 0) {
        return res.status(404).json({ message: "No comparisons found for this company" });
      }

      const enrichedComparisons = await Promise.all(
        comparisons.map(async (comparison) => {
          const currentPolicy = comparison.currentPolicyId 
            ? await storage.getPolicy(comparison.currentPolicyId) 
            : null;
          const offerPolicy = comparison.offerPolicyId 
            ? await storage.getPolicy(comparison.offerPolicyId) 
            : null;
          const company = comparison.companyId 
            ? await storage.getCompany(comparison.companyId) 
            : null;

          return {
            ...comparison,
            currentPolicy,
            offerPolicy,
            company
          };
        })
      );

      res.json(enrichedComparisons);
    } catch (error: any) {
      console.error('[Sammenligning] Error fetching comparisons:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/sammenligning/:userId/:companyId/combined", requireAuth, requireOwnership, async (req, res) => {
    try {
      const { userId, companyId } = req.params;
      
      const combinedOverview = await policyMatchingService.getCombinedOverview(userId, companyId);
      
      const company = await storage.getCompany(companyId);
      
      res.json({
        ...combinedOverview,
        company
      });
    } catch (error: any) {
      console.error('[Sammenligning] Error generating combined overview:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Email routes
  app.post("/api/emails/send-inquiries", emailLimiter, requireAuth, requireCSRFToken, async (req, res) => {
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

      // Get total count for pagination
      const allThreads = await storage.getUserEmailThreads(req.params.userId);
      const totalCount = allThreads.length;
      
      // Use optimized JOIN query to fetch enriched threads in ONE query
      // This eliminates the N+1 problem (was making 100+ queries, now just 2)
      const enrichedThreads = await storage.getUserEmailThreadsEnriched(
        req.params.userId,
        limit,
        offset
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
  app.post("/api/emails/thread/:threadId/send-message", requireAuth, async (req, res) => {
    try {
      console.log("📤 Sending custom message for thread:", req.params.threadId);
      
      // Validate request body
      const { message } = validationSchemas.validateBody(validationSchemas.sendMessageSchema)(req.body);
      
      // Validate thread ID parameter
      validationSchemas.validateParams(validationSchemas.threadIdParamSchema)(req.params);

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

  // Debug endpoint for OCR extraction data
  app.get("/api/debug/ocr/:documentId", requireAuth, async (req, res) => {
    try {
      const { documentId } = req.params;
      const requestingUserId = req.headers['x-user-id'] as string;

      // Get document
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check ownership
      if (document.userId !== requestingUserId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Get associated policies
      const policies = await storage.getPoliciesByDocument(documentId);

      // Get the markdown from OCR raw response
      const ocrRawResponse = document.ocrRawResponse as any;
      const extractedMarkdown = ocrRawResponse?.pages 
        ? ocrRawResponse.pages.map((page: any) => page.markdown).join('\n\n---\n\n')
        : 'No markdown available';

      logger.info('[Debug OCR] Retrieved OCR data', { 
        documentId, 
        userId: requestingUserId,
        policiesCount: policies.length,
        markdownLength: extractedMarkdown.length
      });

      res.json({
        document: {
          id: document.id,
          fileName: document.fileName,
          documentType: document.documentType,
          extractionStatus: document.extractionStatus,
          totalPoliciesExtracted: document.totalPoliciesExtracted,
          createdAt: document.createdAt
        },
        ocrData: {
          extractedMarkdown,
          markdownLength: extractedMarkdown.length,
          pageCount: ocrRawResponse?.pages?.length || 0
        },
        policies: policies.map(p => ({
          id: p.id,
          policyType: p.policyType,
          companyId: p.companyId,
          premium: p.premium,
          deductible: p.deductible,
          isOwnPolicy: p.isOwnPolicy,
          sourcePageRange: p.sourcePageRange,
          coverageDetails: p.coverageDetails,
          healthCheckPayload: p.healthCheckPayload,
          healthCheckStatus: p.healthCheckStatus
        }))
      });
    } catch (error: any) {
      logger.error('[Debug OCR] Failed to retrieve debug data', error, { 
        documentId: req.params.documentId 
      });
      res.status(500).json({ message: error.message, stack: error.stack });
    }
  });

  // Debug endpoint for extraction stages (OfferSnapshots)
  app.get("/api/debug/extraction-stages/:documentId", requireAuth, async (req, res) => {
    try {
      const { documentId } = req.params;
      const requestingUserId = req.headers['x-user-id'] as string;

      // Get document
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check ownership
      if (document.userId !== requestingUserId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Get OfferSnapshots for this document
      const snapshots = await storage.getOfferSnapshotsByDocument(documentId);

      // Get legacy policies for comparison
      const policies = await storage.getPoliciesByDocument(documentId);

      logger.info('[Debug Extraction] Retrieved extraction data', { 
        documentId, 
        userId: requestingUserId,
        snapshotsCount: snapshots.length,
        policiesCount: policies.length
      });

      res.json({
        document: {
          id: document.id,
          fileName: document.fileName,
          documentType: document.documentType,
          extractionStatus: document.extractionStatus,
          totalPoliciesExtracted: document.totalPoliciesExtracted,
          createdAt: document.createdAt
        },
        newPipeline: {
          enabled: process.env.ENABLE_NEW_EXTRACTION === 'true',
          snapshots: snapshots.map(s => ({
            id: s.id,
            policyType: s.policyType,
            companyId: s.companyId,
            premium: s.premium,
            deductible: s.deductible,
            extractionVersion: s.extractionVersion,
            extractorModel: s.extractorModel,
            extractorProvider: s.extractorProvider,
            confidenceScore: s.confidenceScore,
            validationStatus: s.validationStatus,
            validationErrors: s.validationErrors,
            sourcePageRange: s.sourcePageRange,
            coverageDetails: s.coverageDetails,
            createdAt: s.createdAt
          }))
        },
        legacyPipeline: {
          policies: policies.map(p => ({
            id: p.id,
            policyType: p.policyType,
            companyId: p.companyId,
            premium: p.premium,
            deductible: p.deductible,
            sourcePageRange: p.sourcePageRange,
            coverageDetails: p.coverageDetails
          }))
        },
        comparison: {
          newSnapshotCount: snapshots.length,
          legacyPolicyCount: policies.length,
          delta: snapshots.length - policies.length
        }
      });
    } catch (error: any) {
      logger.error('[Debug Extraction] Failed to retrieve debug data', error, { 
        documentId: req.params.documentId 
      });
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

  // Offers with comparison status (Phase 1: Make offers visible)
  app.get("/api/offers/user/:userId", requireAuth, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      // Get all offer documents for the user
      const offerDocuments = await storage.getUserDocuments(req.params.userId, 'offer');
      const totalCount = offerDocuments.length;
      const paginatedOffers = offerDocuments.slice(offset, offset + limit);

      // Enrich each offer with comparison status, snapshots, and health checks
      const enrichedOffers = await Promise.all(
        paginatedOffers.map(async (doc: DocumentType) => {
          const company = doc.companyId ? await storage.getCompany(doc.companyId) : null;
          const snapshots = await storage.getOfferSnapshotsByDocument(doc.id);
          const healthChecks = await storage.getHealthChecksByDocument(doc.id);
          
          // Determine comparison status using both old comparisons and new company_comparisons
          const comparisons = await storage.getComparisonsByOfferDocument(doc.id);
          let comparisonStatus: 'ok' | 'failed' | 'pending' = 'pending';
          let statusReason: string | null = null;
          
          if (comparisons.length > 0) {
            // Check if any comparison is successful (has valid comparison data)
            const hasSuccessful = comparisons.some((c: Comparison) => 
              c.comparisonData && Object.keys(c.comparisonData as object).length > 0
            );
            comparisonStatus = hasSuccessful ? 'ok' : 'failed';
          }

          // Also check company_comparisons for more detailed status
          let comparisonData: any = null;
          let comparisonId: string | null = null;
          let currentCompanyId: string | null = null;
          
          if (doc.companyId) {
            const companyComparisons = await storage.getCompanyComparisonsByUser(req.params.userId);
            const relevantComparison = companyComparisons.find((cc: CompanyComparison) => 
              cc.offerCompany === doc.companyId
            );
            
            if (relevantComparison) {
              if (relevantComparison.status === 'completed' && relevantComparison.comparisonJSON) {
                comparisonStatus = 'ok';
                comparisonData = relevantComparison.comparisonJSON;
                comparisonId = relevantComparison.id;
                currentCompanyId = relevantComparison.currentCompany;
              } else if (relevantComparison.status === 'failed') {
                comparisonStatus = 'failed';
                statusReason = relevantComparison.statusReason || null;
              }
            }
          }

          return {
            id: doc.id,
            fileName: doc.fileName,
            createdAt: doc.createdAt,
            company,
            snapshotCount: snapshots.length,
            healthCheckCount: healthChecks.length,
            comparisonStatus,
            comparisonCount: comparisons.length,
            statusReason,
            comparisonData,
            comparisonId,
            currentCompanyId
          };
        })
      );

      res.json({
        data: enrichedOffers,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: offset + limit < totalCount
        }
      });
    } catch (error: any) {
      logger.error('Failed to fetch offers', error);
      res.status(500).json({ message: error.message });
    }
  });

  // NEW: Get company comparison by ID (company_comparisons table)
  app.get("/api/company-comparisons/:id", requireAuth, async (req, res) => {
    try {
      const comparison = await storage.getCompanyComparison(req.params.id);
      if (!comparison) {
        return res.status(404).json({ message: "Comparison not found" });
      }

      // Get company details
      const currentCompany = comparison.currentCompany 
        ? await storage.getCompany(comparison.currentCompany) 
        : null;
      const offerCompany = comparison.offerCompany 
        ? await storage.getCompany(comparison.offerCompany) 
        : null;

      res.json({
        ...comparison,
        currentCompanyName: currentCompany?.name || 'Ukendt',
        offerCompanyName: offerCompany?.name || 'Ukendt',
        comparisonData: comparison.comparisonJSON
      });
    } catch (error: any) {
      logger.error('Failed to fetch company comparison', error, { comparisonId: req.params.id });
      res.status(500).json({ message: error.message });
    }
  });

  // Generate debug report for a comparison
  app.post("/api/company-comparisons/:id/debug-report", requireAuth, async (req, res) => {
    try {
      const comparisonId = req.params.id;
      
      // Verify comparison exists
      const comparison = await storage.getCompanyComparison(comparisonId);
      if (!comparison) {
        return res.status(404).json({ message: "Comparison not found" });
      }

      logger.info('Generating debug report', { comparisonId });
      
      // Generate debug report
      const { generateComparisonDebugReport } = await import('./services/comparisonDebugReportService');
      const report = await generateComparisonDebugReport(comparisonId, { 
        saveToDisk: true, 
        logToConsole: false 
      });

      logger.info('Debug report generated', { comparisonId, filePath: report.filePath });

      res.json({
        success: true,
        filePath: report.filePath,
        message: 'Debug report generated successfully'
      });
    } catch (error: any) {
      logger.error('Failed to generate debug report', error, { comparisonId: req.params.id });
      res.status(500).json({ message: error.message });
    }
  });

  // Get comparison by ID (checks both new company_comparisons and legacy comparisons tables)
  app.get("/api/comparisons/:id", requireAuth, async (req, res) => {
    try {
      // First try new company_comparisons table
      const companyComparison = await storage.getCompanyComparison(req.params.id);
      
      if (companyComparison) {
        // Transform company_comparisons data to match old format expected by frontend
        const currentCompany = companyComparison.currentCompany 
          ? await storage.getCompany(companyComparison.currentCompany) 
          : null;
        const offerCompany = companyComparison.offerCompany 
          ? await storage.getCompany(companyComparison.offerCompany) 
          : null;

        // Extract data from comparison_json
        const comparisonJson = companyComparison.comparisonJson as any || {};
        
        // Transform to old format
        res.json({
          id: companyComparison.id,
          userId: companyComparison.userId,
          companyId: companyComparison.offerCompany,
          company: offerCompany,
          savings: comparisonJson.overall?.totalSavingsAnnual || 0,
          savingsPercentage: comparisonJson.overall?.savingsPercentage || 0,
          comparisonData: comparisonJson,
          currentDocument: {
            ocrData: {
              companyName: currentCompany?.name || 'Din nuværende forsikring',
              annualPremium: comparisonJson.overall?.totalCurrentAnnual || 0
            }
          },
          offerDocument: {
            ocrData: {
              companyName: offerCompany?.name || 'Tilbud',
              annualPremium: comparisonJson.overall?.totalOfferAnnual || 0
            }
          },
          createdAt: companyComparison.createdAt
        });
        return;
      }

      // Fallback to legacy comparisons table
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
  app.post("/api/comparisons/:id/regenerate", requireAuth, async (req, res) => {
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
  app.post("/api/comparisons/:id/send-questions", emailLimiter, requireAuth, async (req, res) => {
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
  app.post("/api/comparisons/:id/add-custom-question", requireAuth, async (req, res) => {
    try {
      // Validate request body and parameters
      const validatedBody = validationSchemas.validateBody(z.object({
        question: z.string().min(1, 'Question required').max(500, 'Question too long'),
      }))(req.body);
      const { question } = validatedBody;
      validationSchemas.validateParams(validationSchemas.uuidParamSchema)(req.params);

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
  app.get("/api/stats/:userId", requireAuth, async (req, res) => {
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

  // Insurance Health Check routes
  app.get("/api/health-checks/document/:documentId", requireAuth, async (req, res) => {
    try {
      const { documentId } = req.params;
      const userId = req.headers['x-user-id'] as string;

      // SECURITY: Verify document ownership before returning health check
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (document.userId !== userId) {
        auditLog('unauthorized_health_check_access_attempt', userId, `Attempted to access health check for document ${documentId}`);
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Get the latest health check for this document
      const healthCheck = await storage.getLatestHealthCheckByDocument(documentId);
      
      if (!healthCheck) {
        return res.status(404).json({ message: "No health check found for this document" });
      }

      res.json({
        success: true,
        healthCheck: healthCheck.result,
        dataSource: healthCheck.dataSource,
        confidenceScore: healthCheck.confidenceScore,
        createdAt: healthCheck.createdAt
      });
    } catch (error: any) {
      console.error('[Health Check] Error fetching health check:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/insurance-check/analyze", aiLimiter, requireAuth, async (req, res) => {
    try {
      // Validate request body
      const { documentId } = validationSchemas.validateBody(validationSchemas.insuranceCheckAnalyzeSchema)(req.body);

      // Get the document
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Priority: OfferSnapshot (validated) > Policy > ocrData (legacy)
      let dataToAnalyze: any = null;
      let dataSource = 'unknown';
      let confidenceScore = 0;

      // Try OfferSnapshots first (validated, high-confidence data)
      const snapshots = await storage.getOfferSnapshotsByDocument(documentId);
      if (snapshots && snapshots.length > 0) {
        // Use the snapshot with highest confidence score
        const bestSnapshot = snapshots.reduce((best, current) => 
          (current.confidenceScore || 0) > (best.confidenceScore || 0) ? current : best
        );
        dataToAnalyze = bestSnapshot;
        dataSource = 'OfferSnapshot';
        confidenceScore = bestSnapshot.confidenceScore || 0;
        
        logger.info('[Insurance Check] Using OfferSnapshot', {
          documentId,
          snapshotId: bestSnapshot.id,
          confidence: confidenceScore,
          validationStatus: bestSnapshot.validationStatus
        });
      } 
      // Fallback to ocrData (legacy)
      else if (document.ocrData) {
        dataToAnalyze = document.ocrData;
        dataSource = 'ocrData';
        
        logger.info('[Insurance Check] Using legacy ocrData', {
          documentId,
          policyType: (document.ocrData as any).policyType
        });
      }

      // Ensure we have data to analyze
      if (!dataToAnalyze) {
        return res.status(400).json({ 
          message: "Document has no analyzable data. Please ensure the document was processed successfully." 
        });
      }

      console.log('[Insurance Check] Analyzing document:', {
        documentId,
        fileName: document.fileName,
        dataSource,
        confidenceScore,
        policyType: dataToAnalyze.policyType
      });

      // Perform health check analysis
      const healthCheckResult = await insuranceCheckService.analyzeInsuranceHealth(dataToAnalyze);

      console.log('[Insurance Check] Analysis complete:', {
        score: healthCheckResult.overallScore,
        potentialSavings: healthCheckResult.potentialSavings.realistic
      });

      res.json({
        success: true,
        documentId,
        document: {
          id: document.id,
          fileName: document.fileName,
          policyType: dataToAnalyze.policyType
        },
        dataSource,
        confidenceScore,
        healthCheck: healthCheckResult
      });
    } catch (error: any) {
      console.error('[Insurance Check] Error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Household Members routes
  app.get("/api/household-members/:userId", requireAuth, async (req, res) => {
    try {
      const members = await storage.getUserHouseholdMembers(req.params.userId);
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/household-members", requireAuth, async (req, res) => {
    try {
      const { insertHouseholdMemberSchema } = await import("@shared/schema");
      const memberData = insertHouseholdMemberSchema.parse(req.body);
      const member = await storage.createHouseholdMember(memberData);
      res.json(member);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/household-members/:id", requireAuth, async (req, res) => {
    try {
      const { insertHouseholdMemberSchema } = await import("@shared/schema");
      const updates = insertHouseholdMemberSchema.partial().parse(req.body);
      const member = await storage.updateHouseholdMember(req.params.id, updates);
      res.json(member);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/household-members/:id", requireAuth, async (req, res) => {
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

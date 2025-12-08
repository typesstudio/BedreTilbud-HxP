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
import { policySnapshotService } from "./services/policySnapshots/PolicySnapshotService";
import { requireAuth, requireOwnership } from "./middleware/auth";
import { validateFileUpload } from "./middleware/uploadValidation";
import { uploadLimiter, emailLimiter, aiLimiter, webhookLimiter } from "./middleware/rateLimiting";
import { requireWebhookSecret } from "./middleware/webhookAuth";
import { healthCheckWebhookBodySchema, comparisonWebhookBodySchema } from "./validation/webhookSchemas";
import { generateCSRFToken, requireCSRFToken } from "./middleware/csrf";
import { apiCaching, noCache } from "./middleware/caching";
import { generateSignedUrl, validateSignedUrl } from "./utils/signedUrls";
import { logger, auditLog } from "./utils/logging";
import { calculateFileChecksum, validatePDFFile, scanFileForMalware } from "./utils/fileValidation";
import { convertToPolicyRecord } from "./utils/policyExtractionParser";
import { computeFileHash } from "./utils/hash";
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
    fileSize: 20 * 1024 * 1024 // 20MB limit (Step 1.4: increased to allow file validation to handle oversized files)
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

  // Waitlist signup endpoint (public)
  app.post("/api/waitlist", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: "Email er påkrævet" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ message: "Ugyldig email adresse" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      
      try {
        await storage.addToWaitlist(normalizedEmail);
        logger.info('Waitlist signup', { email: normalizedEmail.substring(0, 3) + '***' });
      } catch (dbError: any) {
        if (dbError.message?.includes('duplicate') || dbError.code === '23505') {
          logger.info('Waitlist duplicate signup attempt', { email: normalizedEmail.substring(0, 3) + '***' });
        } else {
          throw dbError;
        }
      }
      
      res.status(200).json({ 
        success: true, 
        message: "Du er skrevet op til ventelisten" 
      });
    } catch (error: any) {
      logger.error('Waitlist signup failed', error);
      res.status(500).json({ message: "Noget gik galt" });
    }
  });

  // Magic link authentication endpoint
  app.get("/magic/:token", noCache, async (req, res) => {
    const escapeHtml = (str: string): string => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const escapeJs = (str: string): string => {
      return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/</g, '\\x3c')
        .replace(/>/g, '\\x3e');
    };

    const validateRedirectPath = (path: string): boolean => {
      if (!path.startsWith('/')) return false;
      if (path.includes('://')) return false;
      if (path.includes('javascript:')) return false;
      if (path.includes('data:')) return false;
      return true;
    };

    try {
      const { token } = req.params;
      const { magicLinkService } = await import("./services/magicLinkService");
      
      const result = await magicLinkService.consume(token);
      
      if (!result.valid || !result.magicLink) {
        logger.security('Invalid magic link attempt', { token: token.substring(0, 8) + '...', reason: result.error });
        const safeError = escapeHtml(result.error || 'Linket er udløbet eller ugyldigt. Kontakt os venligst for at få et nyt link.');
        return res.status(400).send(`
<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ugyldigt link - BedreTilbud</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
    .container { background: white; padding: 40px; border-radius: 12px; text-align: center; max-width: 400px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #dc2626; font-size: 24px; margin-bottom: 16px; }
    p { color: #4a4a4a; line-height: 1.6; }
    a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Linket er ugyldigt</h1>
    <p>${safeError}</p>
    <p><a href="/">Gå til forsiden</a></p>
  </div>
</body>
</html>
        `);
      }

      const { userId, redirectPath } = result.magicLink;
      
      if (!validateRedirectPath(redirectPath)) {
        logger.security('Invalid redirect path in magic link', { userId, redirectPath, token: token.substring(0, 8) + '...' });
        return res.status(400).send(`
<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ugyldigt link - BedreTilbud</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
    .container { background: white; padding: 40px; border-radius: 12px; text-align: center; max-width: 400px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #dc2626; font-size: 24px; margin-bottom: 16px; }
    p { color: #4a4a4a; line-height: 1.6; }
    a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Linket er ugyldigt</h1>
    <p>Der er sket en fejl med linket. Kontakt os venligst for at få et nyt link.</p>
    <p><a href="/">Gå til forsiden</a></p>
  </div>
</body>
</html>
        `);
      }
      
      const safeUserId = escapeJs(userId);
      const safeRedirectPath = escapeJs(redirectPath);
      
      logger.info('Magic link authenticated', { userId, redirectPath, token: token.substring(0, 8) + '...' });
      
      res.send(`
<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Logger ind... - BedreTilbud</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
    .container { background: white; padding: 40px; border-radius: 12px; text-align: center; max-width: 400px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 16px; }
    p { color: #4a4a4a; }
    .spinner { width: 40px; height: 40px; border: 4px solid #e5e5e5; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite; margin: 20px auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>Logger ind...</h1>
    <p>Du bliver snart videresendt til din sammenligning.</p>
  </div>
  <script>
    localStorage.setItem('userId', '${safeUserId}');
    window.location.href = '${safeRedirectPath}';
  </script>
</body>
</html>
      `);
    } catch (error: any) {
      logger.error('Magic link error', error);
      res.status(500).send(`
<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <title>Fejl - BedreTilbud</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
    .container { background: white; padding: 40px; border-radius: 12px; text-align: center; max-width: 400px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #dc2626; font-size: 24px; }
    a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Der opstod en fejl</h1>
    <p>Prøv venligst igen senere.</p>
    <p><a href="/">Gå til forsiden</a></p>
  </div>
</body>
</html>
      `);
    }
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

  // Benchmark Prices routes (for savings calculations)
  app.get("/api/benchmark-prices", apiCaching(300), async (req, res) => {
    try {
      const prices = await storage.getAllBenchmarkPrices();
      res.json(prices);
    } catch (error: any) {
      logger.error('Failed to fetch benchmark prices', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/benchmark-prices", requireAuth, requireCSRFToken, async (req, res) => {
    try {
      const { policyType, annualPremium } = req.body;
      if (!policyType || typeof annualPremium !== 'number') {
        return res.status(400).json({ message: 'policyType and annualPremium are required' });
      }
      await storage.setBenchmarkPrice(policyType, annualPremium);
      logger.info('Benchmark price updated', { policyType, annualPremium });
      res.json({ success: true, policyType, annualPremium });
    } catch (error: any) {
      logger.error('Failed to update benchmark price', error);
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
      const duplicateFiles: string[] = [];

      // Define max file size constant (20 MB)
      const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;

      for (const file of files) {
        let document;
        let matchResult = null;
        
        try {
          // STEP 0: Check file size BEFORE processing
          if (file.size > MAX_PDF_SIZE_BYTES) {
            logger.warn('[Upload] File too large, rejecting', { 
              fileName: file.originalname, 
              fileSize: file.size,
              maxSize: MAX_PDF_SIZE_BYTES,
              userId 
            });
            
            // Create failed document record for tracking
            const failedDocument = await storage.createDocument({
              userId,
              fileName: file.originalname,
              filePath: file.path,
              fileSize: file.size,
              extractionStatus: 'failed',
              errorReason: 'file_too_large',
              documentType
            });
            
            // Clean up the uploaded file
            await fs.promises.unlink(file.path).catch(() => {});
            
            documentsWithPolicies.push({
              document: failedDocument,
              error: 'file_too_large',
              errorMessage: 'Filen er for stor. Upload en PDF på maks 20 MB.',
              policies: []
            });
            continue; // Skip to next file
          }

          // STEP 1: Compute file hash and check for duplicates
          const fileBuffer = await fs.promises.readFile(file.path);
          const fileHash = computeFileHash(fileBuffer);
          
          logger.info('[Upload] Computed file hash', { 
            fileName: file.originalname, 
            fileHash: fileHash.substring(0, 16) + '...',
            userId 
          });
          
          // Check if this file has already been uploaded by this user
          const existingDocument = await storage.getDocumentByFileHash(userId, fileHash);
          
          if (existingDocument) {
            logger.info('[Upload] Duplicate file detected, skipping', { 
              fileName: file.originalname, 
              existingDocumentId: existingDocument.id,
              userId 
            });
            
            // Clean up the uploaded file since we won't use it
            await fs.promises.unlink(file.path).catch(() => {});
            
            duplicateFiles.push(file.originalname);
            continue; // Skip to next file
          }
          
          // NEW 2-STEP PIPELINE (v2.1.0): Create document first, then run orchestrator
          logger.info('[Upload] Starting new 2-step extraction pipeline', { 
            fileName: file.originalname, 
            userId 
          });
          
          // Create document placeholder (orchestrator will populate OCR data)
          // Step 3.1: Create with 'pending' status - orchestrator will set to 'processing'
          document = await storage.createDocument({
            userId,
            fileName: file.originalname,
            filePath: file.path,
            fileSize: file.size,
            fileHash, // Store the file hash for duplicate detection
            ocrRawResponse: null, // Will be populated by orchestrator
            extractionStatus: 'pending',
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
          
          // Determine specific error reason from error message
          let errorReason = 'ocr_failed';
          let errorMessage = 'Der skete en teknisk fejl, da vi forsøgte at læse filen. Prøv igen eller upload en anden version.';
          
          const errorMessageLower = (error.message || '').toLowerCase();
          
          if (errorMessageLower.includes('password') || errorMessageLower.includes('encrypted') || errorMessageLower.includes('needs password')) {
            errorReason = 'pdf_password_protected';
            errorMessage = 'PDF\'en er beskyttet med adgangskode. Gem en version uden kode, eller tag en kopi/screenshot og upload som en almindelig PDF.';
          } else if (errorMessageLower.includes('invalid pdf') || errorMessageLower.includes('parse error') || errorMessageLower.includes('corrupt') || errorMessageLower.includes('truncated')) {
            errorReason = 'pdf_corrupt';
            errorMessage = 'Vi kunne ikke læse denne PDF-fil. Prøv at downloade den igen fra dit forsikringsselskab og upload en ny version.';
          }
          
          // If document was created, mark as failed with specific error reason
          if (document) {
            await storage.updateDocument(document.id, {
              extractionStatus: 'failed',
              errorReason
            });
          }

          // Continue to next file instead of failing entire upload
          documentsWithPolicies.push({
            document: document || null,
            error: errorReason,
            errorMessage,
            policies: []
          });
        }
      }

      // RACE CONDITION FIX: Run ComparisonOrchestrator AFTER all files processed
      // This ensures batch uploads are fully processed before comparison runs
      // Only run for offer documents that had successful health checks
      const totalHealthChecksCreated = documentsWithPolicies.reduce(
        (sum, doc) => sum + (doc.healthChecksCreated || 0), 
        0
      );
      
      if (documentType === 'offer' && totalHealthChecksCreated > 0) {
        try {
          logger.info('[Upload] Triggering comparison pipeline after batch upload completed', {
            userId,
            filesProcessed: files.length,
            totalHealthChecksCreated,
            documentsProcessed: documentsWithPolicies.filter(d => !d.error).length
          });

          const { ComparisonOrchestrator } = await import('./services/comparisonOrchestrator');
          const comparisonOrchestrator = new ComparisonOrchestrator(storage);
          
          const comparisonResult = await comparisonOrchestrator.runForUser({
            userId,
            forceRerun: false
          });

          logger.info('[Upload] Comparison pipeline completed for batch', {
            userId,
            comparisonsCreated: comparisonResult.comparisonsCreated,
            comparisonsFailed: comparisonResult.comparisonsFailed,
            skipped: comparisonResult.skipped,
            skipReason: comparisonResult.skipReason
          });

        } catch (comparisonError: any) {
          logger.error('[Upload] Comparison pipeline failed for batch', comparisonError instanceof Error ? comparisonError : new Error(String(comparisonError)), {
            userId,
            filesProcessed: files.length
          });
          // Don't fail the upload if comparison fails - user can manually trigger later
        }
      }

      // If ALL files were duplicates and no new documents were created
      if (documentsWithPolicies.length === 0 && duplicateFiles.length > 0) {
        return res.status(200).json({
          ok: false,
          errorCode: 'duplicate_file',
          message: 'Du har allerede uploadet denne fil.',
          duplicateFiles
        });
      }

      // Return result with info about any duplicates that were skipped
      res.json({
        documents: documentsWithPolicies,
        duplicateFiles: duplicateFiles.length > 0 ? duplicateFiles : undefined,
        hasDuplicates: duplicateFiles.length > 0
      });
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

  // Toggle document active status
  app.patch("/api/documents/:id/active", requireAuth, requireCSRFToken, async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const userId = req.headers['x-user-id'] as string;
      if (document.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { isActive } = req.body;
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }

      const { db } = await import("./db");
      const { documents: documentsTable } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      await db.update(documentsTable)
        .set({ isActive })
        .where(eq(documentsTable.id, req.params.id));

      logger.info('[Document] Active status updated', { documentId: req.params.id, isActive });
      res.json({ id: req.params.id, isActive });
    } catch (error: any) {
      logger.error('Failed to update document active status', error, { documentId: req.params.id });
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

      const { db } = await import("./db");
      const { policies, policySnapshots, offerSnapshots, healthChecks } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      // CASCADE DELETE: Delete all related records before deleting the document
      const documentId = req.params.id;

      // 1. Delete health checks referencing this document
      await db.delete(healthChecks).where(eq(healthChecks.documentId, documentId));
      logger.info('[Document Delete] Health checks deleted', { documentId });

      // 2. Delete policy snapshots referencing this document
      await db.delete(policySnapshots).where(eq(policySnapshots.documentId, documentId));
      logger.info('[Document Delete] Policy snapshots deleted', { documentId });

      // 3. Delete offer snapshots referencing this document
      await db.delete(offerSnapshots).where(eq(offerSnapshots.documentId, documentId));
      logger.info('[Document Delete] Offer snapshots deleted', { documentId });

      // 4. Delete policies associated with this document
      await db.delete(policies).where(eq(policies.documentId, documentId));
      logger.info('[Document Delete] Policies deleted', { documentId });

      // 5. Delete the physical file
      if (document.filePath && fs.existsSync(document.filePath)) {
        fs.unlinkSync(document.filePath);
      }

      // 6. Finally delete the document record
      await storage.deleteDocument(documentId);
      auditLog('document_deleted', userId, `Deleted document: ${document.fileName}`);
      
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
          
          // Step 3.1: Reset status to 'pending' before reprocessing
          await db
            .update(documentsTable)
            .set({ extractionStatus: 'pending', errorReason: null })
            .where(eq(documentsTable.id, doc.id));
          
          // Run NEW extraction pipeline (OCR → Segmentation → Per-segment Extraction)
          const { ExtractionOrchestratorService } = await import('./services/extractionOrchestratorService');
          const orchestrator = new ExtractionOrchestratorService(storage);
          const orchestratorResult = await orchestrator.processDocument(doc.id);
          
          if (!orchestratorResult.success) {
            throw new Error(orchestratorResult.error || 'Extraction pipeline failed');
          }
          
          // Step 3.1: Orchestrator already updated status to 'completed' with totalPoliciesExtracted
          console.log(`[Reprocess] Extraction completed: ${orchestratorResult.snapshots.length} policies found`);

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

  // Force reprocess a specific document by ID (for debugging/fixing)
  app.post("/api/documents/force-reprocess/:documentId", requireAuth, async (req, res) => {
    try {
      const { documentId } = req.params;
      const { db } = await import("./db");
      const { documents: documentsTable, policySnapshots: policySnapshotsTable, healthChecks: healthChecksTable } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      // Get the document
      const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.id, documentId));
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }

      console.log(`[Force Reprocess] Starting for document ${documentId}: ${doc.fileName}`);

      // Delete existing policy snapshots and health checks for this document
      await db.delete(healthChecksTable).where(eq(healthChecksTable.documentId, documentId));
      await db.delete(policySnapshotsTable).where(eq(policySnapshotsTable.documentId, documentId));
      console.log(`[Force Reprocess] Cleared existing snapshots and health checks`);

      // Reset document status
      await db
        .update(documentsTable)
        .set({ extractionStatus: 'pending', errorReason: null })
        .where(eq(documentsTable.id, documentId));

      // Run extraction pipeline with forceReprocess to bypass duplicate detection
      const { ExtractionOrchestratorService } = await import('./services/extractionOrchestratorService');
      const orchestrator = new ExtractionOrchestratorService(storage);
      const result = await orchestrator.processDocument(documentId, { forceReprocess: true });

      if (!result.success) {
        return res.status(500).json({ 
          message: "Extraction failed", 
          error: result.error,
          stages: result.stages
        });
      }

      // Log rawText lengths for each snapshot
      for (const snapshot of result.snapshots) {
        console.log(`[Force Reprocess] Snapshot ${snapshot.policyType}: rawText length = ${(snapshot as any).rawText?.length || 0}`);
      }

      res.json({
        message: `Successfully reprocessed document`,
        documentId,
        fileName: doc.fileName,
        snapshotsCreated: result.snapshots.length,
        policyTypes: result.snapshots.map(s => s.policyType)
      });
    } catch (error: any) {
      console.error(`[Force Reprocess] Error:`, error);
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
  // Step 4.1: Extended to include partial coverage info
  app.get("/api/policies/comparisons", requireAuth, async (req, res) => {
    try {
      // Get authenticated user ID from headers (set by requireAuth middleware)
      const userId = req.headers['x-user-id'] as string;
      
      // Validate userId exists
      if (!userId) {
        logger.warn('[PolicyComparisons] Missing user ID in authenticated request');
        return res.status(401).json({ message: "User not authenticated" });
      }

      logger.info('[PolicyComparisons] Fetching comparisons with coverage', { userId });

      // Get comparisons with partial coverage info from PolicyComparisonService
      const result = await policyComparisonService.getComparisonsWithCoverage(userId);

      logger.info('[PolicyComparisons] Comparisons retrieved', { 
        userId, 
        comparisonCount: result.comparisons.length,
        matchedCount: result.matchedCount,
        missingCount: result.missingInOffers.length,
        coversAll: result.coversAllCurrentPolicies,
        policyTypes: result.comparisons.map(c => c.policyType)
      });

      res.json(result);
    } catch (error: any) {
      logger.error('[PolicyComparisons] Failed to fetch comparisons', error, { 
        userId: req.headers['x-user-id'] as string | undefined
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
  // DRAFT WORKFLOW: All outgoing emails must be approved by admin before sending
  // This creates drafts for admin review instead of sending directly
  app.post("/api/emails/send-inquiries", emailLimiter, requireAuth, requireCSRFToken, async (req, res) => {
    try {
      const { userId, companyIds, customMessage } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user's ACTIVE current documents for attachments (only docs user has marked as active)
      const currentDocs = await storage.getActiveUserDocuments(userId, 'current');
      const attachmentPaths = currentDocs.map(doc => doc.filePath);

      // Validate: Must have active documents to attach
      if (currentDocs.length === 0) {
        return res.status(400).json({ 
          message: "Du har ingen aktive forsikringsdokumenter. Upload dokumenter eller aktiver eksisterende dokumenter på din profilside, før du kan anmode om tilbud." 
        });
      }

      // Extract unique policy types from OCR data for the email
      const ocrPolicies = currentDocs
        .map(doc => doc.ocrData)
        .filter((p): p is { policyType: string; annualPremium: number; companyName: string } => 
          Boolean(p && typeof p === 'object' && 'policyType' in p)
        );

      const uniquePolicyTypes = Array.from(
        new Set(
          ocrPolicies
            .map(p => p.policyType)
            .filter(Boolean)
        )
      );

      // Validate: Warn if no policy types found (OCR may have failed)
      if (uniquePolicyTypes.length === 0) {
        console.warn(`[Email] No policy types found for user ${userId} - OCR may have failed or documents not processed`);
        // Continue but use fallback text - the PDFs are still attached for reference
      }

      // Build the requested insurances list for the email
      const requestedInsurances = uniquePolicyTypes.length > 0
        ? uniquePolicyTypes.map(type => `- ${type}`).join('\n')
        : '- Forsikring (baseret på vedhæftede policer)';

      const threadIds = [];

      for (const companyId of companyIds) {
        const company = await storage.getCompany(companyId);
        if (!company) continue;

        // Generate personalized email with simplified context
        // NOTE: For initial inquiries, we intentionally DO NOT include CPR numbers
        // PII validation happens below to catch any accidental inclusion
        const emailBody = customMessage || await comparisonService.generatePersonalizedEmail(
          company.name,
          {
            userName: user.name || undefined,
            // DO NOT include cprNumber in initial inquiry - privacy protection
            requestedInsurances
          }
        );

        // PII VALIDATION: Block CPR, phone numbers, and addresses in first contact
        const { validateEmailForPII } = await import("./utils/piiValidator");
        const piiValidation = validateEmailForPII(emailBody);
        
        if (!piiValidation.isValid) {
          console.warn(`[PII] Blocked PII in initial inquiry to ${company.name}:`, 
            piiValidation.blockedItems.map(i => `${i.type}: ${i.match.substring(0, 4)}...`));
          return res.status(400).json({
            message: piiValidation.message,
            blockedItems: piiValidation.blockedItems.map(i => ({
              type: i.type,
              redacted: i.redacted
            }))
          });
        }

        // DRAFT WORKFLOW: Create thread and draft for admin approval instead of sending directly
        // This ensures all initial outreach emails are reviewed before sending
        const subject = `Forespørgsel om forsikringstilbud - ${user.name || user.email}`;
        const { generateRequestToken, formatReplyToEmail } = await import("./utils/tokenGenerator");
        const requestToken = generateRequestToken();
        const replyToEmail = formatReplyToEmail(requestToken);

        // Create email thread with draft_pending status
        const thread = await storage.createEmailThread({
          userId,
          companyId,
          subject,
          threadId: '', // Will be populated when email is actually sent
          requestToken,
          replyToEmail,
          status: 'draft_pending',
          aiMode: 'draft'
        });

        // Create draft email for admin approval
        // Store attachment paths in metadata for when the email is approved and sent
        await storage.createEmail({
          threadId: thread.id,
          messageId: '',
          direction: 'outbound',
          subject,
          body: emailBody,
          attachments: attachmentPaths.map(p => ({ fileName: require('path').basename(p), filePath: p })),
          metadata: { 
            isInitialInquiry: true, 
            attachmentPaths,
            companyEmail: company.email
          },
          sentAt: new Date(),
          status: 'draft',
          authorType: 'user'
        });

        console.log(`[Draft] Created initial inquiry draft for ${company.name} (thread: ${thread.id})`);
        threadIds.push(thread.id);
      }

      res.json({ 
        threadIds, 
        message: "Dine forespørgsler er oprettet og afventer godkendelse fra administrator.",
        isDraft: true
      });
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

  // Start or get existing email thread for a user + company
  // Returns existing thread if one exists, otherwise creates a new one
  app.post("/api/emails/start-thread", requireAuth, async (req, res) => {
    try {
      const { userId, companyId } = req.body;
      
      if (!userId || !companyId) {
        return res.status(400).json({ message: "userId and companyId are required" });
      }

      // Check if thread already exists
      const existingThread = await storage.getEmailThreadByCompany(userId, companyId);
      
      if (existingThread) {
        // Return existing thread
        return res.json({ 
          threadId: existingThread.id,
          isNew: false,
          message: "Existing thread found"
        });
      }

      // Create new thread
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Generate unique request token
      const { generateRequestToken, formatReplyToEmail } = await import("./utils/tokenGenerator");
      const requestToken = generateRequestToken();
      const replyToEmail = formatReplyToEmail(requestToken);
      
      const subject = `Samtale med ${company.name} - ${user.name || user.email}`;
      
      const newThread = await storage.createEmailThread({
        userId,
        companyId,
        subject,
        threadId: '', // No Gmail thread ID yet since no email sent
        requestToken,
        replyToEmail,
        status: 'pending'
      });

      res.json({ 
        threadId: newThread.id,
        isNew: true,
        message: "New thread created"
      });
    } catch (error: any) {
      console.error('[Start Thread] Error:', error);
      res.status(500).json({ message: error.message });
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

  // ====== AI Draft Management Endpoints ======

  // Get all pending AI drafts for a user
  app.get("/api/emails/drafts/:userId", requireAuth, async (req, res) => {
    try {
      const drafts = await storage.getDraftEmailsByUser(req.params.userId);
      res.json({ drafts });
    } catch (error: any) {
      console.error("[Drafts] Error fetching drafts:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get AI drafts for a specific thread
  app.get("/api/emails/thread/:threadId/drafts", requireAuth, async (req, res) => {
    try {
      const drafts = await storage.getThreadDraftEmails(req.params.threadId);
      res.json({ drafts });
    } catch (error: any) {
      console.error("[Drafts] Error fetching thread drafts:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Approve and send a draft (handles both AI reply drafts and initial inquiry drafts)
  app.post("/api/emails/draft/:id/approve", requireAuth, async (req, res) => {
    try {
      const draftId = req.params.id;
      const authenticatedUserId = req.user!.id;
      const authenticatedUser = await storage.getUser(authenticatedUserId);
      const isAdmin = authenticatedUser?.isAdmin === true;
      
      console.log("📤 Approving draft:", draftId, "by user:", authenticatedUserId, "isAdmin:", isAdmin);

      // Get the draft with thread for authorization
      const result = await storage.getEmailWithThread(draftId);
      
      if (!result) {
        return res.status(404).json({ message: "Draft ikke fundet" });
      }

      const { email: draft, thread } = result;

      // Verify draft status
      if (draft.status !== 'draft') {
        return res.status(400).json({ message: "Beskeden er ikke en kladde" });
      }

      // Authorization: check if authenticated user owns this thread OR is admin
      if (thread.userId !== authenticatedUserId && !isAdmin) {
        return res.status(403).json({ message: "Du har ikke adgang til denne kladde" });
      }

      // Check if this is an initial inquiry draft (needs Gmail with attachments)
      const metadata = draft.metadata as { isInitialInquiry?: boolean; attachmentPaths?: string[]; companyEmail?: string } | null;
      const isInitialInquiry = metadata?.isInitialInquiry === true;

      let sentEmail;
      
      if (isInitialInquiry) {
        // INITIAL INQUIRY: Send via Gmail with attachments
        console.log("📨 Sending initial inquiry via Gmail with attachments");
        
        const attachmentPaths = metadata?.attachmentPaths || [];
        const companyEmail = metadata?.companyEmail;
        
        if (!companyEmail) {
          return res.status(400).json({ message: "Mangler forsikringsselskabets email" });
        }
        
        // Import Gmail client and send email
        const { getUncachableGmailClient } = await import("./googleMailClient");
        const { gmailOAuthService } = await import("./services/gmailOAuthService");
        const fs = await import("fs");
        const path = await import("path");
        
        // Get Gmail client
        let gmail;
        try {
          if (gmailOAuthService.isConfigured()) {
            gmail = await gmailOAuthService.getGmailClient();
          } else {
            gmail = await getUncachableGmailClient();
          }
        } catch (gmailError) {
          console.error("[Draft Approve] Gmail client error:", gmailError);
          return res.status(500).json({ message: "Kunne ikke forbinde til Gmail" });
        }
        
        // Get user for sender name
        const user = thread.userId ? await storage.getUser(thread.userId) : null;
        const senderName = user?.name ? `${user.name} via BedreTilbud` : 'BedreTilbud';
        
        // Encode header for Danish characters
        const encodeEmailHeader = (text: string): string => {
          const hasNonAscii = /[^\x00-\x7F]/.test(text);
          if (!hasNonAscii) return text;
          const base64 = Buffer.from(text, 'utf8').toString('base64');
          return `=?UTF-8?B?${base64}?=`;
        };
        
        const fromHeader = `${encodeEmailHeader(senderName)} <hej@bedretilbud.com>`;
        
        // Build email with attachments
        let emailContent = [
          `To: ${companyEmail}`,
          `From: ${fromHeader}`,
          `Reply-To: ${thread.replyToEmail}`,
          `Subject: ${encodeEmailHeader(draft.subject || '')}`,
          'MIME-Version: 1.0',
          'Content-Type: multipart/mixed; boundary="boundary123"',
          '',
          '--boundary123',
          'Content-Type: text/plain; charset=UTF-8',
          '',
          draft.body || '',
          '',
        ];

        // Add attachments
        for (const filePath of attachmentPaths) {
          if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath).toString('base64');
            const fileName = path.basename(filePath);
            
            emailContent.push(
              '--boundary123',
              `Content-Type: application/pdf; name="${fileName}"`,
              'Content-Transfer-Encoding: base64',
              `Content-Disposition: attachment; filename="${fileName}"`,
              '',
              fileContent,
              ''
            );
          }
        }
        
        emailContent.push('--boundary123--');
        
        const raw = Buffer.from(emailContent.join('\n')).toString('base64');
        
        const gmailResult = await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw }
        });
        
        // Update draft to sent status
        sentEmail = await storage.updateEmail(draftId, {
          messageId: gmailResult.data.id || '',
          status: 'sent',
          sentAt: new Date()
        });
        
        // Update thread with Gmail thread ID and change status to sent
        await storage.updateEmailThread(thread.id, {
          threadId: gmailResult.data.threadId || '',
          status: 'sent'
        });
        
        console.log("✅ Initial inquiry sent via Gmail:", gmailResult.data.id);
        
      } else {
        // REPLY DRAFT: Send via Resend (existing flow)
        sentEmail = await emailService.sendFollowUpEmail(
          thread.id,
          draft.body || '',
          { existingDraftId: draftId }
        );
        
        console.log("✅ Reply draft approved and sent:", sentEmail.id);
      }

      res.json({
        success: true,
        email: sentEmail,
        message: "Besked godkendt og sendt"
      });
    } catch (error: any) {
      console.error("[Draft Approve] Error:", error);
      res.status(500).json({ message: error.message || "Kunne ikke godkende draft" });
    }
  });

  // Reject (discard) an AI draft
  app.post("/api/emails/draft/:id/reject", requireAuth, async (req, res) => {
    try {
      const draftId = req.params.id;
      const authenticatedUserId = req.user!.id;
      const authenticatedUser = await storage.getUser(authenticatedUserId);
      const isAdmin = authenticatedUser?.isAdmin === true;
      
      console.log("❌ Rejecting AI draft:", draftId, "by user:", authenticatedUserId, "isAdmin:", isAdmin);

      // Get the draft with thread for authorization
      const result = await storage.getEmailWithThread(draftId);
      
      if (!result) {
        return res.status(404).json({ message: "Draft ikke fundet" });
      }

      const { email: draft, thread } = result;

      // Verify draft status
      if (draft.status !== 'draft') {
        return res.status(400).json({ message: "Beskeden er ikke en kladde" });
      }

      // Authorization: check if authenticated user owns this thread OR is admin
      if (thread.userId !== authenticatedUserId && !isAdmin) {
        return res.status(403).json({ message: "Du har ikke adgang til denne kladde" });
      }

      // Update draft status to rejected
      const updated = await storage.updateEmail(draftId, { status: 'rejected' });

      console.log("✅ Draft rejected:", updated.id);

      res.json({
        success: true,
        message: "Draft afvist"
      });
    } catch (error: any) {
      console.error("[Draft Reject] Error:", error);
      res.status(500).json({ message: error.message || "Kunne ikke afvise draft" });
    }
  });

  // Edit an AI draft before approving
  app.patch("/api/emails/draft/:id", requireAuth, async (req, res) => {
    try {
      const draftId = req.params.id;
      const authenticatedUserId = req.user!.id;
      const authenticatedUser = await storage.getUser(authenticatedUserId);
      const isAdmin = authenticatedUser?.isAdmin === true;
      const { body, subject } = req.body;
      
      console.log("✏️ Editing AI draft:", draftId, "by user:", authenticatedUserId, "isAdmin:", isAdmin);

      // Get the draft with thread for authorization
      const result = await storage.getEmailWithThread(draftId);
      
      if (!result) {
        return res.status(404).json({ message: "Draft ikke fundet" });
      }

      const { email: draft, thread } = result;

      // Verify draft status
      if (draft.status !== 'draft') {
        return res.status(400).json({ message: "Beskeden er ikke en kladde" });
      }

      // Authorization: check if authenticated user owns this thread OR is admin
      if (thread.userId !== authenticatedUserId && !isAdmin) {
        return res.status(403).json({ message: "Du har ikke adgang til denne kladde" });
      }

      // Update draft content
      const updates: any = {};
      if (body !== undefined) updates.body = body;
      if (subject !== undefined) updates.subject = subject;

      const updated = await storage.updateEmail(draftId, updates);

      console.log("✅ Draft edited:", updated.id);

      res.json({
        success: true,
        email: updated,
        message: "Draft opdateret"
      });
    } catch (error: any) {
      console.error("[Draft Edit] Error:", error);
      res.status(500).json({ message: error.message || "Kunne ikke opdatere draft" });
    }
  });

  // Update thread AI mode
  app.patch("/api/emails/thread/:threadId/ai-mode", requireAuth, async (req, res) => {
    try {
      const { aiMode } = req.body;
      
      if (!['manual', 'auto', 'off'].includes(aiMode)) {
        return res.status(400).json({ message: "Ugyldig AI mode" });
      }

      const thread = await storage.updateEmailThread(req.params.threadId, { aiMode });

      res.json({
        success: true,
        thread,
        message: `AI mode opdateret til ${aiMode}`
      });
    } catch (error: any) {
      console.error("[AI Mode] Error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Debug endpoint for document extraction status (Step 3.1)
  app.get("/api/debug/document-status", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ message: "userId required" });
      }

      const { db } = await import("./db");
      const { documents: documentsTable } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      const docs = await db
        .select({
          id: documentsTable.id,
          fileName: documentsTable.fileName,
          documentType: documentsTable.documentType,
          extractionStatus: documentsTable.extractionStatus,
          errorReason: documentsTable.errorReason,
          totalPoliciesExtracted: documentsTable.totalPoliciesExtracted,
          documentKind: documentsTable.documentKind,
          createdAt: documentsTable.createdAt,
        })
        .from(documentsTable)
        .where(eq(documentsTable.userId, userId))
        .orderBy(desc(documentsTable.createdAt))
        .limit(50);

      const statusCounts = {
        pending: docs.filter(d => d.extractionStatus === 'pending').length,
        processing: docs.filter(d => d.extractionStatus === 'processing').length,
        completed: docs.filter(d => d.extractionStatus === 'completed').length,
        failed: docs.filter(d => d.extractionStatus === 'failed').length,
      };

      const errorReasonCounts: Record<string, number> = {};
      docs.filter(d => d.errorReason).forEach(d => {
        const reason = d.errorReason || 'unknown';
        errorReasonCounts[reason] = (errorReasonCounts[reason] || 0) + 1;
      });

      res.json({
        totalDocuments: docs.length,
        statusCounts,
        errorReasonCounts,
        documents: docs.map(d => ({
          id: d.id,
          fileName: d.fileName,
          documentType: d.documentType,
          extractionStatus: d.extractionStatus,
          errorReason: d.errorReason,
          totalPoliciesExtracted: d.totalPoliciesExtracted,
          documentKind: d.documentKind,
          createdAt: d.createdAt,
        }))
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

  // ====== AI Debug Reports Endpoints ======

  // Get AI debug reports (admin)
  app.get("/api/debug/ai-reports", requireAuth, async (req, res) => {
    try {
      const threadId = req.query.threadId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const { debugAgentService } = await import("./services/debugAgentService");
      const reports = await debugAgentService.getRecentReports(threadId, limit);
      
      res.json({ reports });
    } catch (error: any) {
      logger.error('[AI Debug] Failed to fetch reports', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get AI debug metrics (admin)
  app.get("/api/debug/ai-metrics", requireAuth, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      
      const { debugAgentService } = await import("./services/debugAgentService");
      const metrics = await debugAgentService.getAggregatedMetrics(days);
      
      res.json(metrics);
    } catch (error: any) {
      logger.error('[AI Debug] Failed to fetch metrics', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get debug report for specific AI message
  app.get("/api/debug/ai-reports/:messageId", requireAuth, async (req, res) => {
    try {
      const { debugAgentService } = await import("./services/debugAgentService");
      const report = await debugAgentService.getReportByMessageId(req.params.messageId);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      res.json({ report });
    } catch (error: any) {
      logger.error('[AI Debug] Failed to fetch report', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ====== Admin Endpoints ======

  // Get all email threads (admin - for dashboard overview)
  app.get("/api/admin/threads", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const threads = await storage.getAllEmailThreadsEnriched(limit, offset);
      
      res.json({ 
        threads,
        count: threads.length 
      });
    } catch (error: any) {
      logger.error('[Admin] Failed to fetch all threads', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all pending drafts (admin - for attention needed overview)
  app.get("/api/admin/drafts", requireAuth, async (req, res) => {
    try {
      const drafts = await storage.getAllDraftEmails();
      
      res.json({ 
        drafts,
        count: drafts.length 
      });
    } catch (error: any) {
      logger.error('[Admin] Failed to fetch all drafts', error);
      res.status(500).json({ message: error.message });
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
          let notificationStatus: string | null = null;
          let notificationError: string | null = null;
          
          if (doc.companyId) {
            // Step 2.4: Only use active (non-superseded) comparisons
            const companyComparisons = await storage.getActiveCompanyComparisonsByUser(req.params.userId);
            const relevantComparison = companyComparisons.find((cc: CompanyComparison) => 
              cc.offerCompany === doc.companyId
            );
            
            if (relevantComparison) {
              // Step 5.1: Include notification status
              notificationStatus = relevantComparison.notificationStatus || 'pending';
              notificationError = relevantComparison.notificationError || null;
              
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

          // Step 5.2: Map status to Danish labels
          const { getOverallStatusLabel } = await import('./utils/companyStatusLabels');
          const statusLabels = getOverallStatusLabel(
            comparisonStatus === 'ok' ? 'completed' : comparisonStatus === 'failed' ? 'failed' : 'pending',
            statusReason,
            notificationStatus as any,
            notificationError
          );

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
            currentCompanyId,
            notificationStatus,
            notificationError,
            statusLabel: statusLabels.comparison.label,
            statusDescription: statusLabels.comparison.description,
            statusVariant: statusLabels.comparison.variant,
            notificationLabel: statusLabels.notification?.label || null,
            notificationDescription: statusLabels.notification?.description || null
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

  // Get all company comparisons for a user
  app.get("/api/company-comparisons/user/:userId", requireAuth, async (req, res) => {
    try {
      const comparisons = await storage.getCompanyComparisonsByUser(req.params.userId);
      
      const enrichedComparisons = await Promise.all(
        comparisons.map(async (comparison: any) => {
          const currentCompany = comparison.currentCompany 
            ? await storage.getCompany(comparison.currentCompany) 
            : null;
          const offerCompany = comparison.offerCompany 
            ? await storage.getCompany(comparison.offerCompany) 
            : null;

          return {
            id: comparison.id,
            userId: comparison.userId,
            currentCompany: currentCompany?.name || null,
            offerCompany: offerCompany?.name || null,
            status: comparison.status,
            createdAt: comparison.createdAt,
            isSuperseded: comparison.isSuperseded || false
          };
        })
      );

      res.json(enrichedComparisons);
    } catch (error: any) {
      logger.error('Failed to fetch user company comparisons', error);
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

  // Delete company comparison
  app.delete("/api/company-comparisons/:id", requireAuth, async (req, res) => {
    try {
      const authenticatedUserId = req.headers["x-user-id"] as string;
      const comparison = await storage.getCompanyComparison(req.params.id);
      
      if (!comparison) {
        return res.status(404).json({ message: "Sammenligning ikke fundet" });
      }

      // Verify ownership
      if (comparison.userId !== authenticatedUserId) {
        return res.status(403).json({ message: "Du har ikke adgang til at slette denne sammenligning" });
      }

      await storage.deleteCompanyComparison(req.params.id);
      
      logger.info('Company comparison deleted', { comparisonId: req.params.id, userId: authenticatedUserId });
      
      res.json({ success: true, message: "Sammenligning slettet" });
    } catch (error: any) {
      logger.error('Failed to delete company comparison', error, { comparisonId: req.params.id });
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

        // Extract data from comparison_json (NOTE: field is comparisonJSON with uppercase JSON)
        const comparisonJson = companyComparison.comparisonJSON as any || {};
        const overall = comparisonJson.overall ?? {};
        
        // Transform to old format
        res.json({
          id: companyComparison.id,
          userId: companyComparison.userId,
          companyId: companyComparison.offerCompany,
          company: offerCompany,
          savings: overall.annualSavings ?? 0,
          savingsPercentage: overall.annualSavingsPercent ?? 0,
          comparisonData: comparisonJson,
          currentDocument: {
            ocrData: {
              companyName: currentCompany?.name || 'Din nuværende forsikring',
              annualPremium: overall.totalCurrentAnnualPremium ?? 0
            }
          },
          offerDocument: {
            ocrData: {
              companyName: offerCompany?.name || 'Tilbud',
              annualPremium: overall.totalOfferAnnualPremium ?? 0
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
        { questionIds } // Store question IDs with the email
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

  // Get health check by policy snapshot ID (with auto-generation)
  app.get("/api/policies/health-check/:snapshotId", requireAuth, async (req, res) => {
    try {
      const { snapshotId } = req.params;
      const userId = req.headers['x-user-id'] as string;

      logger.info('[Health Check API] Fetching health check for snapshot', { snapshotId, userId });

      // Policy type aliases for matching (hus ↔ fritidshus are related types)
      const policyTypeAliases: Record<string, string[]> = {
        hus: ['hus', 'fritidshus'],
        fritidshus: ['fritidshus', 'hus'],
      };

      // Get snapshot details for response
      // Support BOTH policy_snapshots (new) and offer_snapshots (legacy for backwards compatibility)
      // Track which table the snapshot came from to fetch siblings from the SAME table
      let snapshot: any = null;
      let snapshotSource: 'policy_snapshots' | 'offer_snapshots' = 'policy_snapshots';
      let effectiveSnapshotId = snapshotId; // May change if we find a better match
      
      // Try new policy_snapshots first
      const policySnapshotService = new (await import("./services/policySnapshots/PolicySnapshotService")).PolicySnapshotService();
      snapshot = await policySnapshotService.getSnapshotById(snapshotId);

      // Fallback to legacy offer_snapshots if not found
      if (!snapshot) {
        logger.info('[Health Check API] Not found in policy_snapshots, trying offer_snapshots', { snapshotId });
        const offerSnapshot = await storage.getOfferSnapshot(snapshotId);
        if (offerSnapshot) {
          snapshotSource = 'offer_snapshots';
          
          // SMART MATCHING: Check if there's a policy_snapshot with better health check data
          // This handles cases where offer_snapshots has "hus" but policy_snapshots has "fritidshus"
          const documentId = offerSnapshot.documentId;
          const requestedPolicyType = offerSnapshot.policyType;
          const typesToCheck = policyTypeAliases[requestedPolicyType] || [requestedPolicyType];
          
          const policySiblings = await policySnapshotService.getSnapshotsByDocument(documentId);
          if (policySiblings && policySiblings.length > 0) {
            // Find a matching policy_snapshot with health check data
            for (const policySnap of policySiblings) {
              if (typesToCheck.includes(policySnap.policyType)) {
                // Check if this policy_snapshot has a health check with coverage data
                const existingHC = await storage.getHealthCheckBySnapshot(policySnap.id);
                if (existingHC) {
                  const result = existingHC.result as any;
                  const hasWhatsIncluded = Array.isArray(result?.whatsIncluded) && result.whatsIncluded.length > 0;
                  
                  if (hasWhatsIncluded) {
                    logger.info('[Health Check API] Found better match in policy_snapshots', {
                      originalSnapshotId: snapshotId,
                      originalPolicyType: requestedPolicyType,
                      betterSnapshotId: policySnap.id,
                      betterPolicyType: policySnap.policyType,
                      whatsIncludedCount: result.whatsIncluded.length
                    });
                    
                    // Use the better snapshot instead
                    snapshot = policySnap;
                    snapshotSource = 'policy_snapshots';
                    effectiveSnapshotId = policySnap.id;
                    break;
                  }
                }
              }
            }
          }
          
          // If no better match found, use the original offer_snapshot
          if (!snapshot) {
            const structuredPolicy = offerSnapshot.structuredPolicy as any;
            snapshot = {
              id: offerSnapshot.id,
              companyName: 'Ukendt',
              policyType: offerSnapshot.policyType,
              kind: 'offer',
              pricing: structuredPolicy?.pricing || null,
              documentId: offerSnapshot.documentId,
            };
          }
        }
      }

      if (!snapshot) {
        return res.status(404).json({ message: `Snapshot ${snapshotId} not found in policy_snapshots or offer_snapshots` });
      }

      // Auto-generate health check if missing (on-demand generation)
      const { ensureHealthCheckForSnapshot, enrichStoredHealthCheck } = await import("./services/healthCheckService");
      const healthCheck = await ensureHealthCheckForSnapshot(effectiveSnapshotId, userId, storage);

      // Enrich stored health check with benchmark-based savings on-the-fly
      // This ensures old records without savings data still display meaningful numbers
      const offerPremium = snapshot.pricing?.annualPremium 
        || snapshot.structuredPolicy?.pricing?.annualPremium 
        || null;
      
      const enrichedResult = await enrichStoredHealthCheck(
        healthCheck.result as any,
        snapshot.policyType,
        offerPremium,
        storage
      );

      // Fetch sibling snapshots from the same document for tab navigation
      // IMPORTANT: Fetch from the SAME table as the current snapshot to avoid
      // mismatched policy types (e.g., 'hus' in offer_snapshots vs 'fritidshus' in policy_snapshots)
      const documentId = healthCheck.documentId;
      let siblingSnapshots: Array<{ id: string; policyType: string; companyName: string }> = [];
      
      try {
        if (snapshotSource === 'policy_snapshots') {
          // Current snapshot is from policy_snapshots - fetch siblings from same table
          const policySiblings = await policySnapshotService.getSnapshotsByDocument(documentId);
          if (policySiblings && policySiblings.length > 0) {
            siblingSnapshots = policySiblings.map((s: any) => ({
              id: s.id,
              policyType: s.policyType,
              companyName: s.companyName || 'Ukendt',
            }));
          }
        } else {
          // Current snapshot is from offer_snapshots - fetch siblings from same table
          const offerSiblings = await storage.getOfferSnapshotsByDocument(documentId);
          if (offerSiblings && offerSiblings.length > 0) {
            siblingSnapshots = offerSiblings.map((s: any) => ({
              id: s.id,
              policyType: s.policyType,
              companyName: 'Ukendt',
            }));
          }
        }
        
        logger.info('[Health Check API] Found sibling snapshots', { 
          documentId, 
          snapshotSource,
          count: siblingSnapshots.length,
          types: siblingSnapshots.map(s => s.policyType)
        });
      } catch (siblingError: any) {
        logger.warn('[Health Check API] Failed to fetch siblings', { error: siblingError?.message });
        // Continue without siblings - tabs will be static
      }

      // Find the company_comparison associated with this document
      // The comparison is linked via: document.company_id = company_comparisons.offer_company
      let comparisonId: string | null = null;
      let threadId: string | null = null;
      let offerCompanyId: string | null = null;
      try {
        // Get the document to find its company_id
        const document = await storage.getDocument(documentId);
        if (document && document.companyId) {
          offerCompanyId = document.companyId;
          // Step 2.4: Only use active (non-superseded) comparisons
          const userId = req.headers['x-user-id'] as string;
          const companyComparisons = await storage.getActiveCompanyComparisonsByUser(userId);
          const relevantComparison = companyComparisons.find(
            (cc: any) => cc.offerCompany === document.companyId && cc.status === 'completed'
          );
          if (relevantComparison) {
            comparisonId = relevantComparison.id;
            logger.info('[Health Check API] Found company comparison for document', { 
              documentId,
              companyId: document.companyId,
              comparisonId 
            });
          }
          
          // Find the email thread for this user + company combination
          const emailThread = await storage.getEmailThreadByCompany(userId, document.companyId);
          if (emailThread) {
            threadId = emailThread.id;
            logger.info('[Health Check API] Found email thread for offer', {
              documentId,
              companyId: document.companyId,
              threadId
            });
          }
        }
      } catch (comparisonError: any) {
        logger.warn('[Health Check API] Failed to find comparison or thread', { error: comparisonError?.message });
      }

      res.json({
        snapshot: {
          id: snapshot.id,
          companyName: snapshot.companyName || 'Ukendt',
          policyType: snapshot.policyType,
          kind: snapshot.kind,
          pricing: snapshot.pricing,
        },
        healthCheck: {
          ...healthCheck,
          result: enrichedResult,
        },
        siblingSnapshots,
        documentId,
        comparisonId,
        threadId,
        offerCompanyId,
      });
    } catch (error: any) {
      logger.error('[Health Check API] Error fetching/generating health check', error, { snapshotId: req.params.snapshotId });
      
      // Return appropriate error codes
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }
      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({ message: error.message });
      }
      
      res.status(500).json({ message: error.message });
    }
  });

  // Get aggregated health check overview for all policies in same document
  // Returns total savings, coverage status table, and aggregated improvement areas
  app.get("/api/policies/health-check-overview/by-snapshot/:snapshotId", requireAuth, async (req, res) => {
    try {
      const { snapshotId } = req.params;
      const userId = req.headers['x-user-id'] as string;

      logger.info('[Health Check Overview API] Fetching aggregated overview', { snapshotId, userId });

      // Get the snapshot to find the document ID
      const policySnapshotService = new (await import("./services/policySnapshots/PolicySnapshotService")).PolicySnapshotService();
      let snapshot: any = await policySnapshotService.getSnapshotById(snapshotId);
      let snapshotSource: 'policy_snapshots' | 'offer_snapshots' = 'policy_snapshots';
      
      // Fallback to offer_snapshots
      if (!snapshot) {
        const offerSnapshot = await storage.getOfferSnapshot(snapshotId);
        if (offerSnapshot) {
          snapshotSource = 'offer_snapshots';
          snapshot = {
            id: offerSnapshot.id,
            documentId: offerSnapshot.documentId,
            policyType: offerSnapshot.policyType,
          };
        }
      }

      if (!snapshot) {
        return res.status(404).json({ message: `Snapshot ${snapshotId} not found` });
      }

      const documentId = snapshot.documentId;

      // Authorization check
      const document = await storage.getDocument(documentId);
      if (!document || document.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Get all sibling snapshots from the same document
      let siblingSnapshots: any[] = [];
      if (snapshotSource === 'policy_snapshots') {
        siblingSnapshots = await policySnapshotService.getSnapshotsByDocument(documentId);
      } else {
        const offerSnapshots = await storage.getOfferSnapshotsByDocument(documentId);
        siblingSnapshots = offerSnapshots.map((s: any) => ({
          id: s.id,
          policyType: s.policyType,
          companyName: 'Ukendt',
          documentId: s.documentId,
          pricing: (s.structuredPolicy as any)?.pricing || null,
          structuredPolicy: s.structuredPolicy || null,
        }));
      }

      // Helper function to extract coverage sum from the correct data sources
      const extractCoverageSum = (structuredPolicy: any, healthCheckResult: any, rawText?: string): string | null => {
        // 1) Prefer explicit sum from health_check.result.whatsIncluded
        const whatsIncluded = healthCheckResult?.whatsIncluded ?? [];
        const withSum = whatsIncluded.find(
          (item: any) => item?.attributes?.sum
        );
        if (withSum?.attributes?.sum) {
          return withSum.attributes.sum;
        }

        // 2) Fallback to first mainCoverage with a limit in structuredPolicy.coverageDetails.mainCoverages
        const mainCoverages = structuredPolicy?.coverageDetails?.mainCoverages ?? [];
        const coverageWithLimit = mainCoverages.find((c: any) => c?.limit);
        if (coverageWithLimit?.limit) {
          return coverageWithLimit.limit;
        }

        // 3) Fallback: Parse raw text for "Forsikringssummer" patterns (Danish insurance documents)
        // Look for patterns like "Maks. pr. enkelt genstand: 66.595 kr" or "Forsikringssum: 500.000 kr"
        if (rawText) {
          const patterns = [
            /Maks\.?\s*(?:pr\.?\s*)?enkelt\s*genstand:?\s*([\d.,]+)\s*kr/i,
            /Forsikringssum:?\s*([\d.,]+)\s*kr/i,
            /Indbo(?:forsikring)?:?\s*([\d.,]+)\s*kr/i,
            /Sum\s*(?:forsikret)?:?\s*([\d.,]+)\s*kr/i,
            /Dækningssum:?\s*([\d.,]+)\s*kr/i,
          ];
          for (const pattern of patterns) {
            const match = rawText.match(pattern);
            if (match && match[1]) {
              // Format with proper Danish thousand separator
              const value = match[1].replace(/\./g, '').replace(/,/g, '.');
              const numValue = parseFloat(value);
              if (!isNaN(numValue) && numValue > 1000) { // Only use if it looks like a coverage sum
                return `${numValue.toLocaleString('da-DK')} kr`;
              }
            }
          }
        }

        // 4) If nothing found, return null
        return null;
      };

      // Import health check service functions
      const { enrichStoredHealthCheck, ensureHealthCheckForSnapshot } = await import("./services/healthCheckService");

      const policyTypeLabels: Record<string, string> = {
        indbo: 'Indboforsikring',
        ulykke: 'Ulykkesforsikring',
        hus: 'Husforsikring',
        fritidshus: 'Fritidshusforsikring',
        bil: 'Bilforsikring',
        rejse: 'Rejseforsikring',
        sundhed: 'Sundhedsforsikring',
        ansvar: 'Ansvarsforsikring',
        retshjælp: 'Retshjælpsforsikring',
      };

      // FIX BUG 4: Ensure health checks exist for ALL siblings (not just the requested one)
      // This ensures Fritidshus and other policies get analyzed when viewing overview
      logger.info('[Health Check Overview API] Ensuring health checks for all siblings', {
        count: siblingSnapshots.length,
        types: siblingSnapshots.map(s => s.policyType)
      });

      // Fetch/create health checks for all siblings IN PARALLEL
      const healthCheckPromises = siblingSnapshots.map(async sibling => {
        try {
          // ensureHealthCheckForSnapshot creates the health check if it doesn't exist
          const hc = await ensureHealthCheckForSnapshot(sibling.id, userId, storage);
          return { sibling, healthCheck: hc };
        } catch (error: any) {
          logger.warn('[Health Check Overview API] Failed to ensure health check', { 
            snapshotId: sibling.id, 
            policyType: sibling.policyType,
            error: error?.message 
          });
          return { sibling, healthCheck: null };
        }
      });
      const healthCheckResults = await Promise.all(healthCheckPromises);

      // Helper to format annual premium as Danish currency
      const formatAnnualPremium = (premium: number | null | undefined): string => {
        if (premium == null || premium === 0) return '—';
        return `${premium.toLocaleString('da-DK')} kr/år`;
      };

      // Process results and enrich in parallel
      const enrichmentPromises = healthCheckResults.map(async ({ sibling, healthCheck }) => {
        // Get annual premium from pricing data (works for both current and offer policies)
        const annualPremium = sibling.pricing?.annualPremium 
          || (sibling.structuredPolicy as any)?.pricing?.annualPremium 
          || null;

        if (!healthCheck) {
          return {
            summary: {
              policyId: sibling.id,
              policyType: sibling.policyType,
              policyLabel: policyTypeLabels[sibling.policyType] || sibling.policyType,
              annualSavings: 0,
              currentPremiumYear: annualPremium || 0,
              annualPremiumLabel: formatAnnualPremium(annualPremium),
              recommendation: 'pending' as const,
              recommendationLabel: 'Afventer analyse',
              issues: [],
            },
            issues: [],
          };
        }

        const offerPremium = annualPremium;
        const enrichedResult = await enrichStoredHealthCheck(
          healthCheck.result as any,
          sibling.policyType,
          offerPremium,
          storage
        );

        // FIX BUG 1: Use cumulativeSavings.after12Months as primary source (consistent with single-policy view)
        // This ensures Overblik total matches sum of individual policy cards
        const annualSavings = enrichedResult.cumulativeSavings?.after12Months 
                              || enrichedResult.potentialSavings?.realistic 
                              || enrichedResult.annualSavings?.amount 
                              || 0;
        const currentPremium = offerPremium || 0;

        const weaknesses = enrichedResult.weaknesses || [];
        const hasErrors = weaknesses.some((w: any) => w.severity === 'error' || w.variant === 'error');
        const hasWarnings = weaknesses.length > 0;
        
        let recommendation: 'good' | 'can_improve' | 'missing' = 'good';
        let recommendationLabel = 'God dækning';
        
        if (hasErrors) {
          recommendation = 'missing';
          recommendationLabel = 'Anbefales';
        } else if (hasWarnings) {
          recommendation = 'can_improve';
          recommendationLabel = 'Kan forbedres';
        }

        // Use annual premium instead of coverage sum
        const annualPremiumLabel = formatAnnualPremium(annualPremium);

        const issues = weaknesses.map((w: any) => ({
          id: `${sibling.id}-${w.title}`,
          severity: (w.severity === 'error' || w.variant === 'error' ? 'error' : 'warning') as 'error' | 'warning',
          title: w.title,
          description: w.description,
          policyTypes: [sibling.policyType],
        }));

        return {
          summary: {
            policyId: sibling.id,
            policyType: sibling.policyType,
            policyLabel: policyTypeLabels[sibling.policyType] || sibling.policyType,
            annualSavings,
            currentPremiumYear: currentPremium,
            annualPremiumLabel,
            recommendation,
            recommendationLabel,
            issues: weaknesses.map((w: any) => ({
              id: w.title,
              severity: w.severity === 'error' || w.variant === 'error' ? 'error' : 'warning',
              title: w.title,
              description: w.description,
            })),
          },
          issues,
        };
      });

      const enrichedResults = await Promise.all(enrichmentPromises);

      // Aggregate results
      const policySummaries = enrichedResults.map(r => r.summary);
      const aggregatedIssues = enrichedResults.flatMap(r => r.issues);
      const totalAnnualSavings = policySummaries.reduce((sum, p) => sum + p.annualSavings, 0);
      const totalCurrentPremiumYear = policySummaries.reduce((sum, p) => sum + p.currentPremiumYear, 0);

      // Calculate savings percentage
      const totalSavingsPct = totalCurrentPremiumYear > 0 
        ? (totalAnnualSavings / totalCurrentPremiumYear) * 100 
        : null;

      // Count good vs total coverages
      const goodCount = policySummaries.filter(p => p.recommendation === 'good').length;
      const totalCount = policySummaries.length;

      // Step 2.4: Only use active (non-superseded) comparisons
      let comparisonId: string | null = null;
      try {
        if (document.companyId) {
          const comparisons = await storage.getActiveCompanyComparisonsByUser(userId);
          const relevantComparison = comparisons.find(
            (cc: any) => cc.offerCompany === document.companyId && cc.status === 'completed'
          );
          if (relevantComparison) {
            comparisonId = relevantComparison.id;
          }
        }
      } catch (comparisonError: any) {
        logger.warn('[Health Check Overview API] Failed to find comparison', { error: comparisonError?.message });
      }

      res.json({
        totalAnnualSavings,
        totalCurrentPremiumYear,
        totalSavingsPct,
        goodCount,
        totalCount,
        coverageStatus: policySummaries,
        aggregatedIssues,
        documentId,
        comparisonId,
        siblingSnapshots: siblingSnapshots.map(s => ({
          id: s.id,
          policyType: s.policyType,
          companyName: s.companyName || 'Ukendt',
        })),
      });
    } catch (error: any) {
      logger.error('[Health Check Overview API] Error', error, { snapshotId: req.params.snapshotId });
      res.status(500).json({ message: error.message });
    }
  });

  // DEV-ONLY: Debug endpoint for health check data inspection
  // Returns raw and enriched health check data for debugging prompts and schema
  if (process.env.NODE_ENV !== "production") {
    app.get("/api/debug/policies/health-check/:snapshotId", requireAuth, async (req, res) => {
      try {
        const { snapshotId } = req.params;
        const userId = req.headers['x-user-id'] as string;

        logger.info('[Debug Health Check] Fetching debug data', { snapshotId, userId });

        // Get the raw health check from database
        const healthCheck = await storage.getHealthCheckBySnapshot(snapshotId);
        if (!healthCheck) {
          return res.status(404).json({ message: "Health check not found" });
        }

        // Get snapshot details
        const policySnapshotService = new (await import("./services/policySnapshots/PolicySnapshotService")).PolicySnapshotService();
        let snapshot: any = await policySnapshotService.getSnapshotById(snapshotId);
        
        // Fallback to offer_snapshots
        if (!snapshot) {
          const offerSnapshot = await storage.getOfferSnapshot(snapshotId);
          if (offerSnapshot) {
            const structuredPolicy = offerSnapshot.structuredPolicy as any;
            snapshot = {
              id: offerSnapshot.id,
              policyType: offerSnapshot.policyType,
              kind: 'offer',
              pricing: structuredPolicy?.pricing || null,
              structuredPolicy: offerSnapshot.structuredPolicy,
            };
          }
        }

        // Get enriched result
        const { enrichStoredHealthCheck } = await import("./services/healthCheckService");
        const offerPremium = snapshot?.pricing?.annualPremium 
          || snapshot?.structuredPolicy?.pricing?.annualPremium 
          || null;
        
        const enrichedResult = await enrichStoredHealthCheck(
          healthCheck.result as any,
          snapshot?.policyType || 'indbo',
          offerPremium,
          storage
        );

        res.json({
          debug: {
            snapshotId,
            policyType: snapshot?.policyType,
            offerPremium,
            healthCheckId: healthCheck.id,
            dataSource: healthCheck.dataSource,
            confidenceScore: healthCheck.confidenceScore,
          },
          rawResult: healthCheck.result,
          enrichedResult,
          snapshot: {
            id: snapshot?.id,
            policyType: snapshot?.policyType,
            pricing: snapshot?.pricing,
            structuredPolicy: snapshot?.structuredPolicy,
          },
          promptInfo: {
            promptName: 'server/ai-prompts/health-check/analysis.md',
            schemaVersion: 'v2-two-phase',
          },
        });
      } catch (error: any) {
        logger.error('[Debug Health Check] Error', error, { snapshotId: req.params.snapshotId });
        res.status(500).json({ message: error.message });
      }
    });
  }

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

  // ============================================================================
  // READ-ONLY ENDPOINTS FOR PRE-COMPUTED DATA (Ticket B)
  // These endpoints serve cached health check and comparison JSON directly
  // without any AI calls or heavy computation. Fast, deterministic responses.
  // ============================================================================

  /**
   * GET /api/v2/health-check/user/:userId/overview
   * Returns all policy summaries for a user from pre-computed healthCheckJson.
   * No AI calls - purely reads from database.
   */
  app.get("/api/v2/health-check/user/:userId/overview", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const requestUserId = req.headers['x-user-id'] as string;

      // Authorization check
      if (userId !== requestUserId) {
        return res.status(403).json({ error: "Not authorized to view this user's data" });
      }

      logger.info('[Health Check Overview V2] Fetching from cached JSON', { userId });

      // Import helper for policy labels
      const { getPolicyTypeLabel } = await import("../shared/apiTypes");
      
      // Get all snapshots for this user
      const snapshots = await policySnapshotService.getSnapshotsForUser(userId);

      // Map to DTO format
      const policies = snapshots.map((row) => {
        const hc = row.healthCheckJson as any;
        
        return {
          id: row.id,
          policyType: row.policyType,
          policyLabel: getPolicyTypeLabel(row.policyType),
          companyName: row.companyName || null,
          kind: row.kind,
          annualPremium: hc?.annualPremium ?? null,
          healthScore: hc?.score ?? null,
          potentialSavingsAnnual: hc?.potentialSavingsAnnual ?? null,
          statusLabel: hc?.statusLabel ?? null,
          hasHealthCheck: !!hc,
        };
      });

      const response = {
        userId,
        totalPolicies: policies.length,
        policiesWithHealthCheck: policies.filter(p => p.hasHealthCheck).length,
        policies,
      };

      logger.info('[Health Check Overview V2] Response prepared', { 
        userId, 
        totalPolicies: response.totalPolicies,
        policiesWithHealthCheck: response.policiesWithHealthCheck
      });

      return res.json(response);
    } catch (error: any) {
      logger.error('[Health Check Overview V2] Failed', error);
      return res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/v2/health-check/policy/:policyId
   * Returns the full pre-computed healthCheckJson for a single policy.
   * Returns 404 if healthCheckJson is not yet populated.
   */
  app.get("/api/v2/health-check/policy/:policyId", requireAuth, async (req, res) => {
    try {
      const { policyId } = req.params;
      const userId = req.headers['x-user-id'] as string;

      logger.info('[Health Check Detail V2] Fetching cached JSON', { policyId, userId });

      const snapshot = await policySnapshotService.getSnapshotById(policyId);

      if (!snapshot) {
        return res.status(404).json({ error: "Policy not found" });
      }

      // Authorization check
      if (snapshot.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to view this policy" });
      }

      if (!snapshot.healthCheckJson) {
        return res.status(404).json({ 
          error: "Health check not ready",
          message: "Sundhedstjek afventer analyse"
        });
      }

      const hc = snapshot.healthCheckJson as any;
      
      // Return full healthCheckJson enriched with policy metadata
      const response = {
        ...hc,
        policyId: snapshot.id,
        policyType: snapshot.policyType,
        companyName: snapshot.companyName,
      };

      logger.info('[Health Check Detail V2] Returning cached JSON', { 
        policyId, 
        hasScore: !!hc.score 
      });

      return res.json(response);
    } catch (error: any) {
      logger.error('[Health Check Detail V2] Failed', error);
      return res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/v2/comparisons/:comparisonId/overview
   * Returns aggregated comparison summary from pre-computed comparisonJSON.
   * No AI calls - purely reads from database.
   */
  app.get("/api/v2/comparisons/:comparisonId/overview", requireAuth, async (req, res) => {
    try {
      const { comparisonId } = req.params;
      const userId = req.headers['x-user-id'] as string;

      logger.info('[Comparison Overview V2] Fetching cached JSON', { comparisonId, userId });

      const comparison = await storage.getCompanyComparison(comparisonId);

      if (!comparison) {
        return res.status(404).json({ error: "Comparison not found" });
      }

      // Authorization check
      if (comparison.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to view this comparison" });
      }

      const cj = comparison.comparisonJSON as any;
      const hasComparison = !!cj;

      // Extract summary data if available
      const overall = cj?.overall ?? cj?.summary ?? {};
      const policyBreakdown = cj?.policyBreakdown ?? cj?.policies ?? [];

      // Import helper for policy labels
      const { getPolicyTypeLabel } = await import("../shared/apiTypes");

      // Map policy breakdown to DTO
      const policies = (Array.isArray(policyBreakdown) ? policyBreakdown : []).map((p: any) => ({
        policyType: p.policyType,
        policyLabel: getPolicyTypeLabel(p.policyType || p.type || ''),
        currentPremium: p.currentPremium ?? p.currentAnnual ?? null,
        offerPremium: p.offerPremium ?? p.offerAnnual ?? null,
        annualSavings: p.savings ?? p.annualSavings ?? null,
        savingsPercent: p.savingsPercent ?? null,
        recommendation: p.recommendation,
      }));

      const response = {
        comparisonId: comparison.id,
        currentCompany: comparison.currentCompany,
        offerCompany: comparison.offerCompany,
        status: comparison.status,
        totalAnnualCurrent: overall.totalCurrentAnnualPremium ?? overall.annualCurrent ?? null,
        totalAnnualOffer: overall.totalOfferAnnualPremium ?? overall.annualOffer ?? null,
        totalAnnualSavings: overall.annualSavings ?? null,
        savingsPercent: overall.annualSavingsPercent ?? overall.savingsPercent ?? null,
        pricingStatus: cj?.meta?.pricingStatus ?? null,
        policies,
        highlights: cj?.highlights ?? [],
        hasComparison,
      };

      logger.info('[Comparison Overview V2] Response prepared', { 
        comparisonId, 
        hasComparison,
        policyCount: policies.length
      });

      return res.json(response);
    } catch (error: any) {
      logger.error('[Comparison Overview V2] Failed', error);
      return res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/v2/comparisons/:comparisonId/detail
   * Returns the full pre-computed comparisonJSON.
   * Returns 404 if comparisonJSON is not yet populated.
   */
  app.get("/api/v2/comparisons/:comparisonId/detail", requireAuth, async (req, res) => {
    try {
      const { comparisonId } = req.params;
      const userId = req.headers['x-user-id'] as string;

      logger.info('[Comparison Detail V2] Fetching cached JSON', { comparisonId, userId });

      const comparison = await storage.getCompanyComparison(comparisonId);

      if (!comparison) {
        return res.status(404).json({ error: "Comparison not found" });
      }

      // Authorization check
      if (comparison.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to view this comparison" });
      }

      if (!comparison.comparisonJSON) {
        return res.status(404).json({ 
          error: "Comparison not ready",
          message: "Sammenligning afventer analyse"
        });
      }

      const cj = comparison.comparisonJSON as any;

      // Return full comparisonJSON enriched with metadata
      const response = {
        ...cj,
        comparisonId: comparison.id,
        currentCompany: comparison.currentCompany,
        offerCompany: comparison.offerCompany,
      };

      logger.info('[Comparison Detail V2] Returning cached JSON', { 
        comparisonId,
        hasSummary: !!cj.summary || !!cj.overall
      });

      return res.json(response);
    } catch (error: any) {
      logger.error('[Comparison Detail V2] Failed', error);
      return res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // WEBHOOK ENDPOINTS (Ticket A - DB & Pipeline)
  // These endpoints allow external flows (n8n, AI agents) to persist
  // pre-computed health check and comparison JSON directly to the database.
  // ============================================================================

  /**
   * POST /api/webhooks/health-check
   * Persist pre-computed health check JSON for a policy snapshot.
   * 
   * Security:
   * - Requires X-Webhook-Secret header for authentication
   * - Rate limited to prevent abuse
   * - Zod schema validation on payload
   * 
   * Body: { policySnapshotId: string, healthCheckJson: HealthCheckJson }
   */
  app.post("/api/webhooks/health-check", webhookLimiter, requireWebhookSecret, async (req, res) => {
    try {
      // Validate request body with Zod schema
      const parseResult = healthCheckWebhookBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        logger.warn('[Webhook] Invalid health check payload', { 
          errors: parseResult.error.errors 
        });
        return res.status(400).json({ 
          error: "Invalid request body",
          details: parseResult.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
      }
      
      const { policySnapshotId, healthCheckJson } = parseResult.data;
      
      // Validate policySnapshotId exists
      const snapshot = await policySnapshotService.getSnapshotById(policySnapshotId);
      if (!snapshot) {
        return res.status(404).json({ 
          error: "Policy snapshot not found",
          policySnapshotId 
        });
      }
      
      // Add computation timestamp if not provided
      const enrichedJson = {
        ...healthCheckJson,
        computedAt: healthCheckJson.computedAt || new Date().toISOString(),
      };
      
      // Update the snapshot with health check JSON
      await policySnapshotService.updateHealthCheckJson(policySnapshotId, enrichedJson);
      
      logger.info('[Webhook] Health check JSON saved', { 
        policySnapshotId, 
        policyType: snapshot.policyType,
        score: healthCheckJson.score
      });
      
      return res.json({ 
        ok: true, 
        policySnapshotId,
        message: "Health check JSON saved successfully"
      });
    } catch (error: any) {
      logger.error('[Webhook] Failed to save health check JSON', error);
      return res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/webhooks/comparison
   * Persist pre-computed comparison JSON for a company comparison.
   * 
   * Security:
   * - Requires X-Webhook-Secret header for authentication
   * - Rate limited to prevent abuse
   * - Zod schema validation on payload
   * 
   * Body: { comparisonId: string, comparisonJson: ComparisonJson }
   */
  app.post("/api/webhooks/comparison", webhookLimiter, requireWebhookSecret, async (req, res) => {
    try {
      // Validate request body with Zod schema
      const parseResult = comparisonWebhookBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        logger.warn('[Webhook] Invalid comparison payload', { 
          errors: parseResult.error.errors 
        });
        return res.status(400).json({ 
          error: "Invalid request body",
          details: parseResult.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
      }
      
      const { comparisonId, comparisonJson } = parseResult.data;
      
      // Validate comparisonId exists
      const comparison = await storage.getCompanyComparison(comparisonId);
      if (!comparison) {
        return res.status(404).json({ 
          error: "Company comparison not found",
          comparisonId 
        });
      }
      
      // Add computation timestamp if not provided
      const enrichedJson = {
        ...comparisonJson,
        meta: {
          ...comparisonJson.meta,
          computedAt: comparisonJson.meta?.computedAt || new Date().toISOString(),
        },
      };
      
      // Update the comparison with JSON using existing method
      await storage.updateCompanyComparisonStatus(comparisonId, 'completed', enrichedJson);
      
      logger.info('[Webhook] Comparison JSON saved', { 
        comparisonId,
        hasSummary: !!comparisonJson.summary,
        pricingStatus: comparisonJson.meta?.pricingStatus
      });
      
      return res.json({ 
        ok: true, 
        comparisonId,
        message: "Comparison JSON saved successfully"
      });
    } catch (error: any) {
      logger.error('[Webhook] Failed to save comparison JSON', error);
      return res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

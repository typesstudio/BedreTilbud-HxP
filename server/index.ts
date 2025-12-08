import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import path from "path";
import fs from "fs";
import { registerRoutes } from "./routes";
import { setupVite, log } from "./vite";
import { emailService } from "./services/emailService";
import { createEmailPollingLock } from "./utils/distributedLock";
import { validateSecrets } from "./config/secrets";
import { globalLimiter } from "./middleware/rateLimiting";
import { corsConfig, securityHeaders } from "./middleware/security";
import { sanitizeDatabaseError, logSensitiveError } from "./utils/errorSanitization";
import { performanceMonitor } from "./utils/performanceMonitor";

// =============================================================================
// PRODUCTION STATIC FILE PATHS - Resolved at module load time
// =============================================================================
const publicDir = path.resolve(process.cwd(), "server/public");
const assetsDir = path.join(publicDir, "assets");
const indexHtml = path.join(publicDir, "index.html");

// Validate all required environment variables before starting the server
validateSecrets();

const app = express();

// =============================================================================
// 1) STATIC ASSETS FIRST - Before ANY other middleware
//    This is critical: static files must never fall through to compression,
//    json parsing, error handlers, or SPA fallback
// =============================================================================
if (process.env.NODE_ENV !== "development") {
  // Fail fast if build is missing - never deploy a blank page silently
  if (!fs.existsSync(indexHtml)) {
    console.error("❌ CRITICAL ERROR: Production build not found!");
    console.error(`   Expected: ${indexHtml}`);
    console.error("   Did you run 'npm run build' before starting?");
    process.exit(1);
  }
  
  if (!fs.existsSync(assetsDir)) {
    console.error("❌ CRITICAL ERROR: Assets directory not found!");
    console.error(`   Expected: ${assetsDir}`);
    process.exit(1);
  }
  
  log(`📦 Production mode: Serving static assets from ${publicDir}`);
  
  // Serve /assets/* with fallthrough:false - missing assets get 404 HERE,
  // never falling through to other middleware or error handlers
  app.use("/assets", express.static(assetsDir, {
    immutable: true,
    maxAge: "1y",
    index: false,
    fallthrough: false, // KEY: 404 for missing assets, no fallthrough
  }));
  
  // Serve other static files (favicon, robots.txt, etc.)
  app.use(express.static(publicDir, {
    maxAge: "1h",
    index: false, // Don't serve index.html here; SPA fallback handles it
  }));
}

// =============================================================================
// 2) MIDDLEWARE - After static serving
// =============================================================================

// Trust proxy in development (for Replit environment)
if (app.get("env") === "development") {
  app.set('trust proxy', 1);
}

// Apply security headers
app.use(securityHeaders);

// Apply CORS policy
app.use(corsConfig);

// Apply global rate limiting
app.use(globalLimiter);

// Enable response compression (gzip/brotli)
app.use(compression({
  filter: (req: Request, res: Response) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024,
  level: 6,
}));

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Request logging middleware (API routes only)
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
      
      performanceMonitor.trackApiRequest(reqPath, duration);
    }
  });

  next();
});

// =============================================================================
// 3) DIAGNOSTIC ENDPOINTS
// =============================================================================

// Health check endpoint for assets verification
app.get("/healthz/assets", (_req, res) => {
  try {
    if (!fs.existsSync(assetsDir)) {
      res.status(500).json({ 
        status: "error", 
        message: "Assets directory not found",
        assetsDir,
        publicDir,
      });
      return;
    }
    
    const files = fs.readdirSync(assetsDir);
    const jsFiles = files.filter(f => f.endsWith('.js'));
    const cssFiles = files.filter(f => f.endsWith('.css'));
    
    res.json({ 
      status: "ok", 
      jsCount: jsFiles.length, 
      cssCount: cssFiles.length,
      totalAssets: files.length,
      assetsDir,
      publicDir,
      indexHtmlExists: fs.existsSync(indexHtml),
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Cannot read assets directory" });
  }
});

// Diagnostic endpoint to debug production file paths
app.get("/debug/paths", (_req, res) => {
  try {
    const cwd = process.cwd();
    const dirname = import.meta.dirname;
    
    const safeReaddir = (dir: string): string[] => {
      try {
        return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
      } catch {
        return ["ERROR: Cannot read"];
      }
    };
    
    const checkPath = (p: string) => ({
      path: p,
      exists: fs.existsSync(p),
      files: safeReaddir(p).slice(0, 20),
      hasAssets: fs.existsSync(path.join(p, "assets")),
      hasIndexHtml: fs.existsSync(path.join(p, "index.html")),
    });
    
    const possiblePaths = [
      publicDir,
      path.resolve(cwd, "dist", "public"),
      path.resolve(dirname, "public"),
      cwd,
      dirname,
    ];
    
    res.json({
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        cwd,
        dirname,
      },
      configuredPaths: {
        publicDir,
        assetsDir,
        indexHtml,
        indexHtmlExists: fs.existsSync(indexHtml),
        assetsDirExists: fs.existsSync(assetsDir),
        assetsFiles: safeReaddir(assetsDir).slice(0, 10),
      },
      pathChecks: possiblePaths.map(checkPath),
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: "Debug endpoint error", 
      message: error?.message || "Unknown error",
    });
  }
});

// =============================================================================
// 4) API ROUTES AND ERROR HANDLING
// =============================================================================

(async () => {
  const server = await registerRoutes(app);

  // Global error handler - returns text/plain for assets to avoid MIME issues
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    // Log sensitive error details securely
    logSensitiveError(err, `${req.method} ${req.path}`);
    
    // If it's an asset request, return text/plain (not JSON) to avoid MIME type issues
    if (req.path?.startsWith("/assets/")) {
      console.error("Asset error:", err?.message || err);
      return res.status(500).type("text/plain").send("Asset error");
    }
    
    // Sanitize database errors to prevent schema disclosure
    const sanitized = sanitizeDatabaseError(err);
    
    // Send sanitized error response
    res.status(sanitized.statusCode).json({ message: sanitized.message });
  });

  // =============================================================================
  // 5) SPA FALLBACK - Only for HTML navigation requests
  // =============================================================================
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    // PRODUCTION: SPA fallback - serve index.html ONLY for HTML navigation
    app.get("*", (req, res, next) => {
      const accept = req.headers.accept || "";
      
      // Only handle GET requests
      if (req.method !== "GET") {
        return next();
      }
      
      // Only serve HTML for requests that accept HTML
      if (!accept.includes("text/html")) {
        return next();
      }
      
      // Never serve HTML for these paths - let them 404 properly
      if (req.path.startsWith("/assets/")) return next();
      if (req.path.startsWith("/api/")) return next();
      if (req.path === "/favicon.ico") return next();
      
      // Serve the SPA
      return res.sendFile(indexHtml);
    });
  }

  // =============================================================================
  // 6) START SERVER
  // =============================================================================
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Auto-polling: Check inbox every 2 minutes with distributed lock
    const POLLING_INTERVAL = 2 * 60 * 1000;
    const pollingLock = createEmailPollingLock();
    
    setInterval(async () => {
      try {
        const result = await pollingLock.executeWithLock(async () => {
          console.log('🔄 Auto-checking inbox...');
          return await emailService.checkInbox();
        });
        
        if (result && result.messagesProcessed > 0) {
          console.log(`✅ Auto-check: Processed ${result.messagesProcessed} messages, created ${result.newDocuments} documents`);
        } else if (result === null) {
          console.log('⏭️  Skipping inbox check (another instance is processing)');
        }
      } catch (error) {
        console.error('❌ Auto-check failed:', error);
      }
    }, POLLING_INTERVAL);
    
    log(`📧 Auto-polling enabled: checking inbox every 2 minutes with distributed lock`);
  });
})();

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

// Validate all required environment variables before starting the server
validateSecrets();

const app = express();

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
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6, // Compression level (0-9, 6 is default balance)
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

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
      
      performanceMonitor.trackApiRequest(path, duration);
    }
  });

  next();
});

// PRODUCTION ONLY: Static assets middleware with correct MIME types (must be before API routes)
// In development, Vite handles this via setupVite()
if (process.env.NODE_ENV !== "development") {
  // Try multiple possible paths for production assets
  // Order of priority: dist/public (vite output), then relative to bundle
  const possiblePaths = [
    path.resolve(process.cwd(), "dist", "public"),  // Vite build output
    path.resolve(import.meta.dirname, "public"),    // Relative to bundled index.js
    path.resolve(process.cwd(), "server", "public"), // Sync-static output
  ];
  
  let distPath: string | null = null;
  let distAssetsPath: string | null = null;
  
  for (const tryPath of possiblePaths) {
    const tryAssetsPath = path.join(tryPath, "assets");
    if (fs.existsSync(tryAssetsPath)) {
      distPath = tryPath;
      distAssetsPath = tryAssetsPath;
      break;
    }
  }
  
  // Verify build output exists
  if (distPath && distAssetsPath) {
    log("📦 Production mode: Serving static assets from " + distAssetsPath);
    
    // Serve /assets/* with correct MIME types and aggressive caching
    app.use("/assets", express.static(distAssetsPath, {
      immutable: true,
      maxAge: 31536000000, // 1 year in ms
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".css")) {
          res.setHeader("Content-Type", "text/css; charset=utf-8");
        } else if (filePath.endsWith(".js")) {
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        } else if (filePath.endsWith(".map")) {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
        } else if (filePath.endsWith(".woff2")) {
          res.setHeader("Content-Type", "font/woff2");
        } else if (filePath.endsWith(".woff")) {
          res.setHeader("Content-Type", "font/woff");
        } else if (filePath.endsWith(".svg")) {
          res.setHeader("Content-Type", "image/svg+xml");
        } else if (filePath.endsWith(".png")) {
          res.setHeader("Content-Type", "image/png");
        } else if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
          res.setHeader("Content-Type", "image/jpeg");
        } else if (filePath.endsWith(".webp")) {
          res.setHeader("Content-Type", "image/webp");
        }
        res.setHeader("Vary", "Accept-Encoding");
      }
    }));
    
    // Health check endpoint for assets verification
    app.get("/healthz/assets", (_req, res) => {
      try {
        const files = fs.readdirSync(distAssetsPath);
        const jsFiles = files.filter(f => f.endsWith('.js'));
        const cssFiles = files.filter(f => f.endsWith('.css'));
        
        if (jsFiles.length === 0 || cssFiles.length === 0) {
          res.status(500).json({ 
            status: "error", 
            message: "Missing JS or CSS assets",
            jsCount: jsFiles.length,
            cssCount: cssFiles.length
          });
          return;
        }
        
        res.json({ 
          status: "ok", 
          jsCount: jsFiles.length, 
          cssCount: cssFiles.length,
          totalAssets: files.length
        });
      } catch (error) {
        res.status(500).json({ status: "error", message: "Cannot read assets directory" });
      }
    });
  } else {
    log("⚠️ Warning: Production assets directory not found. Tried paths:");
    for (const tryPath of possiblePaths) {
      log("   - " + path.join(tryPath, "assets"));
    }
  }
}

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    // Log sensitive error details securely
    logSensitiveError(err, `${req.method} ${req.path}`);
    
    // Sanitize database errors to prevent schema disclosure
    const sanitized = sanitizeDatabaseError(err);
    
    // Send sanitized error response
    res.status(sanitized.statusCode).json({ message: sanitized.message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    // Custom serveStatic that tries multiple paths for production assets
    const staticPaths = [
      path.resolve(process.cwd(), "dist", "public"),  // Vite build output
      path.resolve(import.meta.dirname, "public"),    // Relative to bundled index.js
      path.resolve(process.cwd(), "server", "public"), // Sync-static output
    ];
    
    let staticDistPath: string | null = null;
    for (const tryPath of staticPaths) {
      if (fs.existsSync(path.join(tryPath, "index.html"))) {
        staticDistPath = tryPath;
        break;
      }
    }
    
    if (!staticDistPath) {
      log("❌ Could not find build directory with index.html. Tried:");
      for (const tryPath of staticPaths) {
        log("   - " + tryPath);
      }
      throw new Error("Could not find the build directory, make sure to build the client first");
    }
    
    log("📄 Serving index.html from " + staticDistPath);
    
    // Serve static files (fallback for non-asset files)
    app.use(express.static(staticDistPath));
    
    // Fall through to index.html for SPA routing
    app.use("*", (_req, res) => {
      res.sendFile(path.resolve(staticDistPath as string, "index.html"));
    });
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Auto-polling: Check inbox every 2 minutes with distributed lock
    const POLLING_INTERVAL = 2 * 60 * 1000; // 2 minutes
    const pollingLock = createEmailPollingLock();
    
    setInterval(async () => {
      try {
        // Use distributed lock to prevent duplicate polling across multiple instances
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

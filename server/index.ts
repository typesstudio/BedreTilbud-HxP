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

// Resolve the static build directory for production
// Returns { publicDir, assetsDir, indexHtml } or null if not found
function resolveStaticBuild(): { publicDir: string; assetsDir: string; indexHtml: string } | null {
  const possiblePaths = [
    path.resolve(process.cwd(), "server", "public"),  // sync-static output (primary)
    path.resolve(process.cwd(), "dist", "public"),    // vite build output
    path.resolve(import.meta.dirname, "public"),      // relative to bundled index.js
  ];
  
  for (const publicDir of possiblePaths) {
    const assetsDir = path.join(publicDir, "assets");
    const indexHtml = path.join(publicDir, "index.html");
    
    if (fs.existsSync(indexHtml) && fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir);
      const hasJs = files.some(f => f.endsWith('.js'));
      const hasCss = files.some(f => f.endsWith('.css'));
      
      if (hasJs && hasCss) {
        return { publicDir, assetsDir, indexHtml };
      }
    }
  }
  
  return null;
}

// Cached resolved paths for production
let resolvedBuild: { publicDir: string; assetsDir: string; indexHtml: string } | null = null;

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

// Health check endpoint for assets verification (works in both dev and production)
app.get("/healthz/assets", (_req, res) => {
  try {
    const build = resolvedBuild || resolveStaticBuild();
    
    if (!build) {
      res.status(500).json({ 
        status: "error", 
        message: "Assets directory not found",
        triedPaths: [
          path.resolve(process.cwd(), "server", "public"),
          path.resolve(process.cwd(), "dist", "public"),
          path.resolve(import.meta.dirname, "public"),
        ]
      });
      return;
    }
    
    const files = fs.readdirSync(build.assetsDir);
    const jsFiles = files.filter(f => f.endsWith('.js'));
    const cssFiles = files.filter(f => f.endsWith('.css'));
    
    res.json({ 
      status: "ok", 
      jsCount: jsFiles.length, 
      cssCount: cssFiles.length,
      totalAssets: files.length,
      assetsPath: build.assetsDir,
      publicDir: build.publicDir
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
      files: safeReaddir(p).slice(0, 20), // Limit to 20 files
      hasAssets: fs.existsSync(path.join(p, "assets")),
      hasIndexHtml: fs.existsSync(path.join(p, "index.html")),
    });
    
    const possiblePaths = [
      path.resolve(cwd, "server", "public"),
      path.resolve(cwd, "dist", "public"),
      path.resolve(dirname, "public"),
      path.resolve(dirname, "..", "public"),
      cwd,
      dirname,
    ];
    
    const pathChecks = possiblePaths.map(checkPath);
    
    // Check specific CSS file
    const cssFileName = "index-BBGG7_n0.css";
    const cssFileChecks = possiblePaths.map(p => ({
      path: path.join(p, "assets", cssFileName),
      exists: fs.existsSync(path.join(p, "assets", cssFileName)),
    }));
    
    res.json({
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        cwd,
        dirname,
      },
      resolvedBuild: resolvedBuild ? {
        publicDir: resolvedBuild.publicDir,
        assetsDir: resolvedBuild.assetsDir,
        indexHtml: resolvedBuild.indexHtml,
        indexHtmlExists: fs.existsSync(resolvedBuild.indexHtml),
        assetsDirExists: fs.existsSync(resolvedBuild.assetsDir),
        assetsFiles: safeReaddir(resolvedBuild.assetsDir).slice(0, 10),
      } : null,
      pathChecks,
      cssFileChecks,
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: "Debug endpoint error", 
      message: error?.message || "Unknown error",
      stack: error?.stack,
    });
  }
});

// PRODUCTION ONLY: Serve static assets BEFORE API routes
// In development, Vite middleware handles this via setupVite()
if (process.env.NODE_ENV !== "development") {
  resolvedBuild = resolveStaticBuild();
  
  if (!resolvedBuild) {
    console.error("❌ CRITICAL ERROR: Production build not found!");
    console.error("   Expected index.html and assets/ in one of:");
    console.error("   - server/public/");
    console.error("   - dist/public/");
    console.error("   Did you run 'npm run build' before starting?");
    process.exit(1);
  }
  
  log(`📦 Production mode: Serving static assets from ${resolvedBuild.publicDir}`);
  
  // Serve /assets/* with correct MIME types and immutable caching (hashed filenames)
  app.use("/assets", express.static(resolvedBuild.assetsDir, {
    immutable: true,
    maxAge: "1y",
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
  
  // Serve other static files (favicon, robots.txt, etc.) with shorter cache
  app.use(express.static(resolvedBuild.publicDir, { 
    maxAge: "1h",
    index: false // Don't serve index.html here; SPA fallback handles it
  }));
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
    // PRODUCTION: SPA fallback - serve index.html for all non-API, non-asset GET requests
    // This MUST come after all API routes are registered
    app.get("*", (req, res, next) => {
      // Only handle GET requests
      if (req.method !== "GET") {
        return next();
      }
      
      // Don't serve HTML for API routes - let them 404 properly
      if (req.path.startsWith("/api")) {
        return res.status(404).json({ error: "Not found" });
      }
      
      // Don't serve HTML for missing assets - let them 404 properly
      if (req.path.startsWith("/assets")) {
        return res.status(404).json({ error: "Asset not found" });
      }
      
      // Check if client accepts HTML (browser request vs API client)
      const acceptHeader = req.get("Accept") || "";
      if (!acceptHeader.includes("text/html") && !acceptHeader.includes("*/*")) {
        return next();
      }
      
      // Serve the SPA
      if (resolvedBuild) {
        res.sendFile(resolvedBuild.indexHtml);
      } else {
        res.status(500).send("Server configuration error: build not found");
      }
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

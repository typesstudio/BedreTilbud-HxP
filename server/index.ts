import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { emailService } from "./services/emailService";
import { createEmailPollingLock } from "./utils/distributedLock";

const app = express();

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
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error details for debugging
    console.error(`[Error Handler] ${req.method} ${req.path} - Status: ${status}`);
    console.error('[Error Handler] Error:', err);
    
    // Send error response without crashing the server
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
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

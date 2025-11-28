import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logging';

/**
 * Webhook authentication middleware
 * 
 * Validates requests to webhook endpoints using a shared secret.
 * The secret must be provided in the X-Webhook-Secret header.
 * 
 * Security features:
 * - Constant-time comparison to prevent timing attacks
 * - Rate limiting should be applied separately via webhookLimiter
 * - Logging for audit trail
 * 
 * Environment variables:
 * - WEBHOOK_SECRET: Required shared secret for authentication
 * - ALLOW_INSECURE_WEBHOOKS: Set to "true" to bypass auth in development (NOT for production)
 */
export function requireWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  const allowInsecure = process.env.ALLOW_INSECURE_WEBHOOKS === 'true';
  
  // If no secret is configured
  if (!webhookSecret) {
    // Only allow bypass if explicitly enabled AND not in production
    if (allowInsecure && process.env.NODE_ENV !== 'production') {
      logger.warn('[WebhookAuth] ALLOW_INSECURE_WEBHOOKS enabled - bypassing authentication (DEV ONLY)');
      return next();
    }
    
    // Block the request
    const message = process.env.NODE_ENV === 'production' 
      ? 'Webhook endpoint not configured - contact administrator'
      : 'WEBHOOK_SECRET not set. Set WEBHOOK_SECRET env var or set ALLOW_INSECURE_WEBHOOKS=true for testing';
    
    logger.error('[WebhookAuth] WEBHOOK_SECRET not configured', { 
      isProduction: process.env.NODE_ENV === 'production',
      allowInsecure
    });
    
    return res.status(503).json({ 
      error: 'Webhook endpoint not configured',
      message
    });
  }
  
  const providedSecret = req.headers['x-webhook-secret'] as string;
  
  if (!providedSecret) {
    logger.warn('[WebhookAuth] Missing X-Webhook-Secret header', { 
      path: req.path,
      ip: req.ip 
    });
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Missing X-Webhook-Secret header'
    });
  }
  
  // Constant-time comparison to prevent timing attacks
  if (!constantTimeEquals(providedSecret, webhookSecret)) {
    logger.warn('[WebhookAuth] Invalid webhook secret', { 
      path: req.path,
      ip: req.ip 
    });
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'Invalid webhook secret'
    });
  }
  
  // Secret is valid
  logger.info('[WebhookAuth] Webhook authenticated successfully', { 
    path: req.path 
  });
  next();
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Returns true if strings are equal, false otherwise.
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

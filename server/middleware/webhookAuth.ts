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
 */
export function requireWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  
  // If no secret is configured, allow in development but block in production
  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('[WebhookAuth] WEBHOOK_SECRET not configured in production');
      return res.status(503).json({ 
        error: 'Webhook endpoint not configured',
        message: 'Contact administrator to configure webhook authentication'
      });
    }
    // In development, warn but allow
    logger.warn('[WebhookAuth] WEBHOOK_SECRET not set - allowing request in development mode');
    return next();
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

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// In-memory CSRF token store (for production, use Redis or database)
const csrfTokens = new Map<string, { token: string; expires: number }>();

// Token validity: 1 hour
const TOKEN_VALIDITY = 60 * 60 * 1000;

// Clean up expired tokens every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of Array.from(csrfTokens.entries())) {
    if (data.expires < now) {
      csrfTokens.delete(userId);
    }
  }
}, 10 * 60 * 1000);

export function generateCSRFToken(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(userId, {
    token,
    expires: Date.now() + TOKEN_VALIDITY,
  });
  return token;
}

export function validateCSRFToken(userId: string, token: string): boolean {
  const stored = csrfTokens.get(userId);
  if (!stored) {
    return false;
  }
  
  if (stored.expires < Date.now()) {
    csrfTokens.delete(userId);
    return false;
  }
  
  return stored.token === token;
}

// Middleware to require CSRF token for state-changing requests
export function requireCSRFToken(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  const token = req.headers['x-csrf-token'] as string;
  if (!token) {
    return res.status(403).json({ message: 'CSRF token required' });
  }
  
  if (!validateCSRFToken(userId, token)) {
    return res.status(403).json({ message: 'Invalid or expired CSRF token' });
  }
  
  next();
}

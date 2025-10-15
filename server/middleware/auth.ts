import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

/**
 * Simple authentication middleware for MVP
 * 
 * SECURITY NOTE: This is a minimal implementation for MVP.
 * For production, implement proper authentication:
 * - Password-based auth with bcrypt
 * - Session management with secure cookies
 * - Or use a third-party auth provider (Replit Auth, Auth0, etc.)
 * 
 * Current implementation:
 * - Expects userId in X-User-ID header
 * - Validates user exists in database
 * - Attaches user to req.user for downstream use
 */

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string | null;
      };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Get userId from header (MVP approach)
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      return res.status(401).json({ 
        message: "Authentication required. Please provide X-User-ID header." 
      });
    }

    // Validate user exists
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(401).json({ 
        message: "Invalid user ID" 
      });
    }

    // Attach user to request for downstream use
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name
    };

    next();
  } catch (error: any) {
    console.error('[Auth Middleware] Error:', error);
    res.status(500).json({ message: "Authentication error" });
  }
}

/**
 * Middleware to validate that the requested resource belongs to the authenticated user
 * Use this for endpoints like /api/users/:id, /api/comparisons/:id etc.
 */
export async function requireOwnership(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Check if the resource ID matches the authenticated user ID
    const resourceUserId = req.params.userId || req.params.id;
    
    if (resourceUserId && resourceUserId !== req.user.id) {
      return res.status(403).json({ 
        message: "Access denied. You can only access your own data." 
      });
    }

    next();
  } catch (error: any) {
    console.error('[Ownership Middleware] Error:', error);
    res.status(500).json({ message: "Authorization error" });
  }
}

/**
 * Optional auth - attaches user if present but doesn't require it
 * Useful for endpoints that have different behavior for authenticated vs non-authenticated users
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.headers['x-user-id'] as string;
    
    if (userId) {
      const user = await storage.getUser(userId);
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name
        };
      }
    }

    next();
  } catch (error: any) {
    console.error('[Optional Auth Middleware] Error:', error);
    // Don't fail the request, just continue without user
    next();
  }
}

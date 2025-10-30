import rateLimit from 'express-rate-limit';

// Global API rate limiter - lenient in development, strict in production
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 10000, // Very high limit in dev
  message: { message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and in development for Vite assets
    if (req.path === '/health' || req.path === '/ready') return true;
    // Skip for Vite HMR and dev assets in development
    if (process.env.NODE_ENV !== 'production' && 
        (req.path.startsWith('/@') || req.path.startsWith('/src/'))) {
      return true;
    }
    return false;
  },
});

// Strict limiter for authentication endpoints - 5 requests per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// File upload limiter - 10 uploads per hour (100 in dev)
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  message: { message: 'Too many file uploads, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI endpoint limiter - 20 requests per hour (expensive operations), 200 in dev
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'production' ? 20 : 200,
  message: { message: 'Too many AI requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Email sending limiter - 30 emails per hour (300 in dev)
export const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 30 : 300,
  message: { message: 'Too many email requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

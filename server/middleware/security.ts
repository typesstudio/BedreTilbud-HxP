import cors from 'cors';
import helmet from 'helmet';

// CORS configuration - strict policy for production
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '',
      ...(process.env.ALLOWED_ORIGINS?.split(',') || [])
    ].filter(Boolean)
  : ['http://localhost:5000', 'http://127.0.0.1:5000'];

export const corsConfig = cors({
  origin: (origin, callback) => {
    // In development, allow all origins (for Vite HMR and Replit preview)
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS policy'));
    }
  },
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-ID'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400, // 24 hours
});

// Security headers configuration using helmet
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Needed for Vite dev
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], // Allow Google Fonts stylesheets
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'], // Allow Google Fonts files
      connectSrc: ["'self'", 'https://api.mistral.ai', 'https://api.openai.com', 'wss:'], // Allow WebSocket for Vite HMR
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  
  // Strict Transport Security (HTTPS only)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  
  // Prevent clickjacking
  frameguard: {
    action: 'deny',
  },
  
  // Disable browser features
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none',
  },
  
  // Prevent MIME type sniffing
  noSniff: true,
  
  // Enable XSS protection (legacy browsers)
  xssFilter: true,
  
  // Hide X-Powered-By header
  hidePoweredBy: true,
  
  // Referrer Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
});

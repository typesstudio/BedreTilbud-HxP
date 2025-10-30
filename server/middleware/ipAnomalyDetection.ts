// IP-based Anomaly Detection
// Detects suspicious activity patterns

import { Request } from 'express';
import { logger } from '../utils/logging';

interface IPActivity {
  requestCount: number;
  firstSeen: number;
  lastSeen: number;
  endpoints: Set<string>;
  userAgents: Set<string>;
  failedAuth: number;
  countries?: Set<string>;
}

const ipActivity = new Map<string, IPActivity>();

// Anomaly thresholds
const THRESHOLDS = {
  REQUESTS_PER_MINUTE: 60,
  UNIQUE_ENDPOINTS_PER_MINUTE: 20,
  UNIQUE_USER_AGENTS_PER_HOUR: 5,
  FAILED_AUTH_PER_HOUR: 10,
  RAPID_LOCATION_CHANGE: true, // Flag if IP location changes rapidly
};

function getClientIP(req: Request): string {
  // Get IP from various headers (reverse proxy support)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
    return ips[0].trim();
  }
  
  return req.ip || req.connection.remoteAddress || 'unknown';
}

function getOrCreateActivity(ip: string): IPActivity {
  let activity = ipActivity.get(ip);
  
  if (!activity) {
    activity = {
      requestCount: 0,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      endpoints: new Set(),
      userAgents: new Set(),
      failedAuth: 0,
    };
    ipActivity.set(ip, activity);
  }
  
  return activity;
}

export function trackRequest(req: Request): void {
  const ip = getClientIP(req);
  const activity = getOrCreateActivity(ip);
  
  activity.requestCount++;
  activity.lastSeen = Date.now();
  activity.endpoints.add(req.path);
  
  const userAgent = req.headers['user-agent'];
  if (userAgent) {
    activity.userAgents.add(userAgent);
  }
}

export function trackFailedAuth(req: Request): void {
  const ip = getClientIP(req);
  const activity = getOrCreateActivity(ip);
  
  activity.failedAuth++;
  
  logger.security('Failed authentication attempt', {
    ip,
    path: req.path,
    totalFailures: activity.failedAuth,
  });
}

export interface AnomalyDetectionResult {
  suspicious: boolean;
  reasons: string[];
  riskScore: number; // 0-100
}

export function detectAnomalies(req: Request): AnomalyDetectionResult {
  const ip = getClientIP(req);
  const activity = getOrCreateActivity(ip);
  
  const reasons: string[] = [];
  let riskScore = 0;
  
  const timeSinceFirstSeen = Date.now() - activity.firstSeen;
  const minutesSinceFirstSeen = timeSinceFirstSeen / (60 * 1000);
  
  // Check 1: Excessive requests
  if (minutesSinceFirstSeen > 0) {
    const requestsPerMinute = activity.requestCount / minutesSinceFirstSeen;
    if (requestsPerMinute > THRESHOLDS.REQUESTS_PER_MINUTE) {
      reasons.push(`High request rate: ${requestsPerMinute.toFixed(1)} req/min`);
      riskScore += 30;
    }
  }
  
  // Check 2: Too many unique endpoints (scanning behavior)
  if (activity.endpoints.size > THRESHOLDS.UNIQUE_ENDPOINTS_PER_MINUTE * minutesSinceFirstSeen) {
    reasons.push(`Scanning behavior detected: ${activity.endpoints.size} unique endpoints`);
    riskScore += 25;
  }
  
  // Check 3: Multiple user agents (bot rotation)
  if (activity.userAgents.size > THRESHOLDS.UNIQUE_USER_AGENTS_PER_HOUR) {
    reasons.push(`Multiple user agents: ${activity.userAgents.size} different UAs`);
    riskScore += 20;
  }
  
  // Check 4: Failed authentication attempts
  if (activity.failedAuth > THRESHOLDS.FAILED_AUTH_PER_HOUR) {
    reasons.push(`Brute force attempt: ${activity.failedAuth} failed auth attempts`);
    riskScore += 40;
  }
  
  // Check 5: Suspicious patterns
  const path = req.path.toLowerCase();
  if (
    path.includes('..') || // Path traversal
    path.includes('<script') || // XSS attempt
    path.includes('select') || // SQL injection attempt
    path.includes('union') ||
    path.includes('admin') && !path.startsWith('/api/') // Admin path probing
  ) {
    reasons.push('Suspicious request pattern detected');
    riskScore += 35;
  }
  
  // Check 6: Missing or suspicious user agent
  const userAgent = req.headers['user-agent'];
  if (!userAgent || userAgent.length < 10) {
    reasons.push('Missing or suspicious user agent');
    riskScore += 15;
  }
  
  const suspicious = riskScore >= 50;
  
  if (suspicious) {
    logger.security('Suspicious activity detected', {
      ip,
      riskScore,
      reasons,
      path: req.path,
      method: req.method,
    });
  }
  
  return {
    suspicious,
    reasons,
    riskScore,
  };
}

export function resetIPActivity(ip: string): void {
  ipActivity.delete(ip);
}

// Clean up old IP activity data every 10 minutes
setInterval(() => {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  
  for (const [ip, activity] of Array.from(ipActivity.entries())) {
    if (now - activity.lastSeen > ONE_HOUR) {
      ipActivity.delete(ip);
    }
  }
}, 10 * 60 * 1000);

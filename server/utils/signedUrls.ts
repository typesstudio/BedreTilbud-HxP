import crypto from 'crypto';

// Secret for signing URLs (in production, use environment variable)
const URL_SIGNING_SECRET = process.env.URL_SIGNING_SECRET || crypto.randomBytes(32).toString('hex');

// URL validity: 1 hour
const URL_VALIDITY = 60 * 60 * 1000;

export interface SignedUrlParams {
  filePath: string;
  userId: string;
  expiresAt?: number;
}

export function generateSignedUrl(params: SignedUrlParams): string {
  const expiresAt = params.expiresAt || Date.now() + URL_VALIDITY;
  
  // Create signature
  const payload = `${params.filePath}|${params.userId}|${expiresAt}`;
  const signature = crypto
    .createHmac('sha256', URL_SIGNING_SECRET)
    .update(payload)
    .digest('hex');
  
  // Build URL with query parameters
  const url = new URL('/api/files/download', 'http://localhost');
  url.searchParams.set('path', params.filePath);
  url.searchParams.set('userId', params.userId);
  url.searchParams.set('expires', expiresAt.toString());
  url.searchParams.set('signature', signature);
  
  return url.pathname + url.search;
}

export function validateSignedUrl(
  filePath: string,
  userId: string,
  expires: string,
  signature: string
): { valid: boolean; reason?: string } {
  // Check expiration
  const expiresAt = parseInt(expires, 10);
  if (isNaN(expiresAt) || expiresAt < Date.now()) {
    return { valid: false, reason: 'URL has expired' };
  }
  
  // Verify signature
  const payload = `${filePath}|${userId}|${expiresAt}`;
  const expectedSignature = crypto
    .createHmac('sha256', URL_SIGNING_SECRET)
    .update(payload)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return { valid: false, reason: 'Invalid signature' };
  }
  
  return { valid: true };
}

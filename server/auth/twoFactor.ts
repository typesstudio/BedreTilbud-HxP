// Two-Factor Authentication (2FA) Infrastructure
// Supports TOTP (Time-based One-Time Password)

import crypto from 'crypto';
import { logger } from '../utils/logging';

// TOTP configuration
const TOTP_WINDOW = 1; // Allow 1 time step before/after current
const TOTP_STEP = 30; // 30 seconds per time step
const TOTP_DIGITS = 6; // 6-digit codes

export interface TwoFactorSecret {
  secret: string;
  qrCode: string; // Data URL for QR code
  backupCodes: string[];
}

// Generate a random base32 secret for TOTP
function generateBase32Secret(): string {
  const buffer = crypto.randomBytes(20);
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  
  for (let i = 0; i < buffer.length; i++) {
    secret += base32Chars[buffer[i] % 32];
  }
  
  return secret;
}

// Generate backup codes
function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  
  return codes;
}

export async function generateTwoFactorSecret(
  userId: string,
  appName: string = 'BedreTilbud'
): Promise<TwoFactorSecret> {
  const secret = generateBase32Secret();
  const backupCodes = generateBackupCodes();
  
  // Generate otpauth URL for QR code
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(appName)}:${encodeURIComponent(userId)}?secret=${secret}&issuer=${encodeURIComponent(appName)}`;
  
  // In a real implementation, generate QR code image
  // For now, return the URL (frontend can use a QR code library)
  const qrCode = otpauthUrl;
  
  logger.info('2FA secret generated', { userId, method: 'TOTP' });
  
  return {
    secret,
    qrCode,
    backupCodes,
  };
}

// Generate TOTP code for a given time
function generateTOTP(secret: string, time?: number): string {
  const timeStep = Math.floor((time || Date.now()) / 1000 / TOTP_STEP);
  
  // Convert time step to buffer
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(timeStep));
  
  // Base32 decode secret (simplified - in production use proper base32 library)
  const secretBuffer = Buffer.from(secret, 'ascii');
  
  // HMAC-SHA1
  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(buffer);
  const hash = hmac.digest();
  
  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0xf;
  const code = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  );
  
  // Generate 6-digit code
  return (code % (10 ** TOTP_DIGITS)).toString().padStart(TOTP_DIGITS, '0');
}

export function verifyTOTP(secret: string, token: string): boolean {
  const now = Date.now();
  
  // Check current time window and adjacent windows
  for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
    const time = now + (i * TOTP_STEP * 1000);
    const validToken = generateTOTP(secret, time);
    
    if (validToken === token) {
      return true;
    }
  }
  
  return false;
}

export function verifyBackupCode(
  userBackupCodes: string[],
  providedCode: string
): { valid: boolean; remainingCodes?: string[] } {
  const index = userBackupCodes.indexOf(providedCode.toUpperCase());
  
  if (index === -1) {
    return { valid: false };
  }
  
  // Remove used backup code
  const remainingCodes = [...userBackupCodes];
  remainingCodes.splice(index, 1);
  
  logger.info('Backup code used', { remainingCount: remainingCodes.length });
  
  return {
    valid: true,
    remainingCodes,
  };
}

// Rate limiting for 2FA attempts (prevent brute force)
const twoFactorAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkTwoFactorRateLimit(userId: string): { allowed: boolean; reason?: string } {
  const MAX_ATTEMPTS = 5;
  const WINDOW = 15 * 60 * 1000; // 15 minutes
  
  let attempts = twoFactorAttempts.get(userId);
  
  if (!attempts || attempts.resetAt < Date.now()) {
    attempts = { count: 0, resetAt: Date.now() + WINDOW };
    twoFactorAttempts.set(userId, attempts);
  }
  
  if (attempts.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      reason: 'Too many 2FA attempts. Please try again in 15 minutes.',
    };
  }
  
  attempts.count++;
  return { allowed: true };
}

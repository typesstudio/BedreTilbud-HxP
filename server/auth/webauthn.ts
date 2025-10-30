// WebAuthn / Passkey Support Infrastructure
// Enables passwordless authentication via biometrics/security keys

import crypto from 'crypto';
import { logger } from '../utils/logging';

export interface WebAuthnCredential {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: ('usb' | 'nfc' | 'ble' | 'internal')[];
}

export interface WebAuthnRegistrationOptions {
  challenge: string;
  userId: string;
  userName: string;
  rpName: string; // Relying Party name
  rpId: string; // Relying Party ID (domain)
  timeout?: number;
  attestation?: 'none' | 'indirect' | 'direct';
}

export interface WebAuthnAuthenticationOptions {
  challenge: string;
  timeout?: number;
  rpId: string;
  allowCredentials?: { id: string; type: 'public-key' }[];
}

// In-memory challenge store (use Redis in production)
const challenges = new Map<string, { challenge: string; expiresAt: number }>();

export function generateWebAuthnChallenge(userId: string): string {
  const challenge = crypto.randomBytes(32).toString('base64url');
  
  challenges.set(userId, {
    challenge,
    expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes
  });
  
  // Clean up expired challenges
  const now = Date.now();
  for (const [uid, data] of Array.from(challenges.entries())) {
    if (data.expiresAt < now) {
      challenges.delete(uid);
    }
  }
  
  return challenge;
}

export function getChallenge(userId: string): string | null {
  const data = challenges.get(userId);
  
  if (!data || data.expiresAt < Date.now()) {
    return null;
  }
  
  return data.challenge;
}

export function removeChallenge(userId: string): void {
  challenges.delete(userId);
}

export async function generateRegistrationOptions(
  userId: string,
  userName: string,
  userDisplayName: string
): Promise<WebAuthnRegistrationOptions> {
  const challenge = generateWebAuthnChallenge(userId);
  
  const options: WebAuthnRegistrationOptions = {
    challenge,
    userId,
    userName,
    rpName: 'BedreTilbud',
    rpId: process.env.WEBAUTHN_RP_ID || 'bedretilbud.dk',
    timeout: 60000, // 60 seconds
    attestation: 'none', // Privacy-preserving
  };
  
  logger.info('WebAuthn registration options generated', { userId, userName });
  
  return options;
}

export async function generateAuthenticationOptions(
  userId: string,
  credentialIds?: string[]
): Promise<WebAuthnAuthenticationOptions> {
  const challenge = generateWebAuthnChallenge(userId);
  
  const options: WebAuthnAuthenticationOptions = {
    challenge,
    rpId: process.env.WEBAUTHN_RP_ID || 'bedretilbud.dk',
    timeout: 60000,
  };
  
  if (credentialIds && credentialIds.length > 0) {
    options.allowCredentials = credentialIds.map(id => ({
      id,
      type: 'public-key',
    }));
  }
  
  logger.info('WebAuthn authentication options generated', { userId });
  
  return options;
}

export interface WebAuthnVerificationResult {
  verified: boolean;
  credentialId?: string;
  newCounter?: number;
  error?: string;
}

export async function verifyRegistrationResponse(
  userId: string,
  response: any // In production, use proper WebAuthn types
): Promise<WebAuthnVerificationResult> {
  const challenge = getChallenge(userId);
  
  if (!challenge) {
    return {
      verified: false,
      error: 'Challenge not found or expired',
    };
  }
  
  // In production, use @simplewebauthn/server or similar library
  // This is a placeholder implementation showing the flow
  
  try {
    // 1. Verify challenge matches
    if (response.challenge !== challenge) {
      return { verified: false, error: 'Challenge mismatch' };
    }
    
    // 2. Verify origin
    // 3. Parse and verify authenticator data
    // 4. Verify signature
    // 5. Store credential
    
    removeChallenge(userId);
    
    logger.info('WebAuthn registration verified', { userId });
    
    return {
      verified: true,
      credentialId: response.credentialId,
      newCounter: response.counter || 0,
    };
  } catch (error) {
    logger.error('WebAuthn registration verification failed', error as Error, { userId });
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

export async function verifyAuthenticationResponse(
  userId: string,
  response: any,
  storedCredential: WebAuthnCredential
): Promise<WebAuthnVerificationResult> {
  const challenge = getChallenge(userId);
  
  if (!challenge) {
    return {
      verified: false,
      error: 'Challenge not found or expired',
    };
  }
  
  try {
    // 1. Verify challenge matches
    if (response.challenge !== challenge) {
      return { verified: false, error: 'Challenge mismatch' };
    }
    
    // 2. Verify credential ID matches
    if (response.credentialId !== storedCredential.credentialId) {
      return { verified: false, error: 'Credential ID mismatch' };
    }
    
    // 3. Verify counter (replay attack protection)
    if (response.counter <= storedCredential.counter) {
      logger.security('WebAuthn counter reuse detected', { userId });
      return { verified: false, error: 'Counter reuse detected (possible cloned authenticator)' };
    }
    
    // 4. Verify signature using stored public key
    // In production, use proper cryptographic verification
    
    removeChallenge(userId);
    
    logger.info('WebAuthn authentication verified', { userId });
    
    return {
      verified: true,
      newCounter: response.counter,
    };
  } catch (error) {
    logger.error('WebAuthn authentication verification failed', error as Error, { userId });
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

import { customAlphabet } from 'nanoid';

// Generate alphanumeric tokens without ambiguous characters (0, O, I, l)
const nanoid = customAlphabet('123456789abcdefghijkmnopqrstuvwxyz', 8);

export function generateRequestToken(): string {
  return nanoid();
}

export function formatReplyToEmail(token: string): string {
  return `${token}@bedretilbud.com`;
}

export function extractTokenFromEmail(email: string): string | null {
  // Extract token from TOKEN@bedretilbud.com format
  const match = email.match(/^([a-z0-9]+)@bedretilbud\.com$/i);
  return match ? match[1] : null;
}

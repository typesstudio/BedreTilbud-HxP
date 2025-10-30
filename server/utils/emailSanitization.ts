// Email HTML Content Security Policy
// Sanitizes HTML content from emails to prevent XSS

import { logger } from './logging';

// Allowed HTML tags in email content
const ALLOWED_TAGS = [
  'p', 'br', 'div', 'span', 'strong', 'em', 'b', 'i', 'u',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a', 'img',
];

// Allowed attributes
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  'a': ['href', 'title'],
  'img': ['src', 'alt', 'width', 'height'],
  'div': ['class'],
  'span': ['class'],
  'td': ['colspan', 'rowspan'],
  'th': ['colspan', 'rowspan'],
};

// Dangerous protocols in URLs
const DANGEROUS_PROTOCOLS = [
  'javascript:',
  'data:text/html',
  'vbscript:',
  'file:',
];

function isAllowedTag(tag: string): boolean {
  return ALLOWED_TAGS.includes(tag.toLowerCase());
}

function isAllowedAttribute(tag: string, attr: string): boolean {
  const allowedAttrs = ALLOWED_ATTRIBUTES[tag.toLowerCase()] || [];
  return allowedAttrs.includes(attr.toLowerCase());
}

function isDangerousUrl(url: string): boolean {
  const lower = url.toLowerCase().trim();
  return DANGEROUS_PROTOCOLS.some(protocol => lower.startsWith(protocol));
}

export function sanitizeEmailHTML(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  let sanitized = html;
  
  // Remove <script> tags and content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove <style> tags and content
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove event handlers (onclick, onload, etc.)
  sanitized = sanitized.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
  sanitized = sanitized.replace(/\son\w+\s*=\s*'[^']*'/gi, '');
  
  // Remove dangerous protocols from href and src
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');
  sanitized = sanitized.replace(/src\s*=\s*["']data:text\/html[^"']*["']/gi, 'src=""');
  
  // Remove data: URLs except for images
  sanitized = sanitized.replace(/src\s*=\s*["']data:(?!image)[^"']*["']/gi, 'src=""');
  
  // Remove <object>, <embed>, <iframe> tags
  sanitized = sanitized.replace(/<(object|embed|iframe|frame|frameset)[^>]*>[\s\S]*?<\/\1>/gi, '');
  sanitized = sanitized.replace(/<(object|embed|iframe|frame|frameset)[^>]*\/>/gi, '');
  
  // Remove <form> tags
  sanitized = sanitized.replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '');
  
  // Remove potentially dangerous tags while keeping content
  const dangerousTags = ['script', 'style', 'object', 'embed', 'iframe', 'form'];
  dangerousTags.forEach(tag => {
    const regex = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
    sanitized = sanitized.replace(regex, '');
    sanitized = sanitized.replace(new RegExp(`</${tag}>`, 'gi'), '');
  });
  
  return sanitized;
}

export function extractPlainTextFromHTML(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  // Remove all HTML tags
  let text = html.replace(/<[^>]*>/g, ' ');
  
  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

export function validateEmailContent(content: string): { safe: boolean; reason?: string } {
  if (!content) {
    return { safe: true };
  }
  
  // Check for excessive HTML tags (potential billion laughs attack)
  const tagCount = (content.match(/<[^>]*>/g) || []).length;
  if (tagCount > 1000) {
    logger.security('Excessive HTML tags detected in email content', { tagCount });
    return { safe: false, reason: 'Email content contains excessive HTML tags' };
  }
  
  // Check for nested iframes or objects
  if (/<iframe/i.test(content) || /<object/i.test(content) || /<embed/i.test(content)) {
    logger.security('Dangerous tags detected in email content');
    return { safe: false, reason: 'Email content contains forbidden tags' };
  }
  
  // Check for JavaScript protocol in URLs
  if (/javascript:/i.test(content)) {
    logger.security('JavaScript protocol detected in email content');
    return { safe: false, reason: 'Email content contains dangerous protocols' };
  }
  
  return { safe: true };
}

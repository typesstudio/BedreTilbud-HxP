// AI Prompt Injection Protection
// Detects and sanitizes potentially malicious prompts

const INJECTION_PATTERNS = [
  // Instruction overrides
  /ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/gi,
  /disregard\s+(all\s+)?(previous|above|prior)\s+instructions?/gi,
  /forget\s+(all\s+)?(previous|above|prior)\s+instructions?/gi,
  
  // Role manipulation
  /you\s+are\s+now/gi,
  /act\s+as\s+(a\s+)?(?!insurance|policy|customer)/gi, // Allow insurance-related contexts
  /pretend\s+to\s+be/gi,
  /simulate\s+being/gi,
  
  // System prompts
  /system\s*:\s*/gi,
  /<\s*system\s*>/gi,
  /\[SYSTEM\]/gi,
  
  // Jailbreak attempts
  /DAN\s+mode/gi,
  /developer\s+mode/gi,
  /god\s+mode/gi,
  
  // Encoding attempts
  /base64/gi,
  /&#x?\d+;/g,
  
  // Script injection
  /<script/gi,
  /javascript:/gi,
  /on\w+\s*=/gi, // onclick, onload, etc.
];

const SUSPICIOUS_KEYWORDS = [
  'bypass', 'hack', 'exploit', 'jailbreak', 'override',
  'admin', 'root', 'sudo', 'password', 'token',
];

export function sanitizePrompt(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Remove null bytes and control characters
  let sanitized = input.replace(/\0/g, '').replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  // Limit length to prevent resource exhaustion
  const MAX_LENGTH = 10000;
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH);
  }
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
}

export function detectInjection(input: string): { safe: boolean; reason?: string } {
  if (!input || typeof input !== 'string') {
    return { safe: true };
  }
  
  // Check for known injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return { 
        safe: false, 
        reason: 'Potential prompt injection detected: instruction override attempt' 
      };
    }
  }
  
  // Check for suspicious keyword density
  const lowerInput = input.toLowerCase();
  const suspiciousCount = SUSPICIOUS_KEYWORDS.filter(keyword => 
    lowerInput.includes(keyword)
  ).length;
  
  if (suspiciousCount >= 3) {
    return { 
      safe: false, 
      reason: 'Potential prompt injection detected: high suspicious keyword density' 
      };
  }
  
  // Check for excessive special characters (potential encoding attacks)
  const specialCharRatio = (input.match(/[<>{}[\]\\|`~!@#$%^&*]/g) || []).length / input.length;
  if (specialCharRatio > 0.3) {
    return { 
      safe: false, 
      reason: 'Potential prompt injection detected: excessive special characters' 
    };
  }
  
  return { safe: true };
}

export function validateAIOutput(output: string, expectedType: 'json' | 'text' = 'text'): { valid: boolean; reason?: string } {
  if (!output || typeof output !== 'string') {
    return { valid: false, reason: 'Invalid output: empty or non-string' };
  }
  
  // Check for excessive length
  if (output.length > 50000) {
    return { valid: false, reason: 'Output exceeds maximum length' };
  }
  
  // For JSON outputs, validate structure
  if (expectedType === 'json') {
    try {
      JSON.parse(output);
    } catch (e) {
      return { valid: false, reason: 'Invalid JSON output' };
    }
  }
  
  // Check for suspicious patterns in output (potential data exfiltration)
  const suspiciousPatterns = [
    /<script/gi,
    /javascript:/gi,
    /data:text\/html/gi,
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(output)) {
      return { valid: false, reason: 'Suspicious pattern detected in output' };
    }
  }
  
  return { valid: true };
}

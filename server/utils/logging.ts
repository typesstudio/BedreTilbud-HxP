// Structured logging with PII redaction

interface LogContext {
  userId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  [key: string]: any;
}

enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SECURITY = 'SECURITY',
}

// PII patterns to redact
const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+45\s?)?\d{8}/g,
  cpr: /\d{6}-?\d{4}/g, // Danish CPR number
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  apiKey: /(sk-|pk-|api[-_]?key[-_]?)[a-zA-Z0-9]{20,}/gi,
};

function redactPII(text: string): string {
  let redacted = text;
  
  // Redact email addresses
  redacted = redacted.replace(PII_PATTERNS.email, '[EMAIL_REDACTED]');
  
  // Redact phone numbers
  redacted = redacted.replace(PII_PATTERNS.phone, '[PHONE_REDACTED]');
  
  // Redact CPR numbers
  redacted = redacted.replace(PII_PATTERNS.cpr, '[CPR_REDACTED]');
  
  // Redact credit card numbers
  redacted = redacted.replace(PII_PATTERNS.creditCard, '[CARD_REDACTED]');
  
  // Redact API keys
  redacted = redacted.replace(PII_PATTERNS.apiKey, '[APIKEY_REDACTED]');
  
  return redacted;
}

function redactObject(obj: any): any {
  if (typeof obj === 'string') {
    return redactPII(obj);
  }
  
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item));
  }
  
  const redacted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Fully redact sensitive keys
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('apikey')
    ) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = redactObject(value);
    }
  }
  
  return redacted;
}

class Logger {
  private isDevelopment: boolean;
  
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }
  
  private formatLog(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const redactedContext = context ? redactObject(context) : {};
    
    const logEntry = {
      timestamp,
      level,
      message: this.isDevelopment ? message : redactPII(message),
      ...redactedContext,
    };
    
    return JSON.stringify(logEntry);
  }
  
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.log(this.formatLog(LogLevel.DEBUG, message, context));
    }
  }
  
  info(message: string, context?: LogContext): void {
    console.log(this.formatLog(LogLevel.INFO, message, context));
  }
  
  warn(message: string, context?: LogContext): void {
    console.warn(this.formatLog(LogLevel.WARN, message, context));
  }
  
  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = {
      ...context,
      error: error ? {
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
        name: error.name,
      } : undefined,
    };
    
    console.error(this.formatLog(LogLevel.ERROR, message, errorContext));
  }
  
  security(message: string, context?: LogContext): void {
    // Security events always logged, even in production
    const securityContext = {
      ...context,
      severity: 'SECURITY_EVENT',
    };
    
    console.error(this.formatLog(LogLevel.SECURITY, message, securityContext));
  }
}

export const logger = new Logger();

// Audit logging for sensitive operations
export function auditLog(
  operation: string,
  userId: string,
  resource: string,
  details?: Record<string, any>
): void {
  logger.info(`Audit: ${operation}`, {
    userId,
    resource,
    operation,
    ...details,
  });
}

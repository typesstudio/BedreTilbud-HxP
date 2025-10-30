// Database Error Sanitization
// Prevents schema disclosure and sensitive information leakage

interface SanitizedError {
  message: string;
  statusCode: number;
}

// Patterns that expose internal implementation details
const SENSITIVE_PATTERNS = [
  /column\s+"([^"]+)"/gi,
  /table\s+"([^"]+)"/gi,
  /constraint\s+"([^"]+)"/gi,
  /schema\s+"([^"]+)"/gi,
  /relation\s+"([^"]+)"/gi,
  /database\s+"([^"]+)"/gi,
  /pg_/gi,
  /postgres/gi,
  /connection string/gi,
  /host\s*=\s*[^\s]+/gi,
  /password\s*=\s*[^\s]+/gi,
];

// Common database error codes and their user-friendly messages
const ERROR_MAPPINGS: Record<string, SanitizedError> = {
  // PostgreSQL error codes
  '23505': { 
    message: 'This record already exists. Please use a different value.', 
    statusCode: 409 
  },
  '23503': { 
    message: 'Cannot complete operation: referenced record not found.', 
    statusCode: 400 
  },
  '23502': { 
    message: 'Required field is missing.', 
    statusCode: 400 
  },
  '23514': { 
    message: 'Invalid data: constraint violation.', 
    statusCode: 400 
  },
  '42P01': { 
    message: 'Resource not found.', 
    statusCode: 404 
  },
  '42703': { 
    message: 'Invalid field specified.', 
    statusCode: 400 
  },
  '22P02': { 
    message: 'Invalid data format.', 
    statusCode: 400 
  },
  '08006': { 
    message: 'Service temporarily unavailable. Please try again later.', 
    statusCode: 503 
  },
  '53300': { 
    message: 'Service is too busy. Please try again later.', 
    statusCode: 503 
  },
};

export function sanitizeDatabaseError(error: any): SanitizedError {
  // Default safe error
  const defaultError: SanitizedError = {
    message: 'An error occurred while processing your request.',
    statusCode: 500,
  };
  
  if (!error) {
    return defaultError;
  }
  
  // Check for PostgreSQL error codes
  if (error.code && ERROR_MAPPINGS[error.code]) {
    return ERROR_MAPPINGS[error.code];
  }
  
  // Extract and sanitize error message
  let message = error.message || error.toString() || '';
  
  // Check for common database error patterns
  if (message.includes('duplicate key') || message.includes('unique constraint')) {
    return { 
      message: 'This record already exists. Please use a different value.', 
      statusCode: 409 
    };
  }
  
  if (message.includes('foreign key') || message.includes('violates')) {
    return { 
      message: 'Cannot complete operation: invalid reference.', 
      statusCode: 400 
    };
  }
  
  if (message.includes('not found') || message.includes('does not exist')) {
    return { 
      message: 'The requested resource was not found.', 
      statusCode: 404 
    };
  }
  
  if (message.includes('timeout') || message.includes('timed out')) {
    return { 
      message: 'Request timed out. Please try again.', 
      statusCode: 504 
    };
  }
  
  if (message.includes('connection') || message.includes('ECONNREFUSED')) {
    return { 
      message: 'Service temporarily unavailable. Please try again later.', 
      statusCode: 503 
    };
  }
  
  // Remove sensitive patterns from generic errors
  for (const pattern of SENSITIVE_PATTERNS) {
    message = message.replace(pattern, '[REDACTED]');
  }
  
  // If message is now too generic or still contains technical details, use default
  if (message.includes('[REDACTED]') || message.includes('ERROR') || message.includes('FATAL')) {
    return defaultError;
  }
  
  // Only return sanitized message if it's safe
  if (message.length > 200) {
    message = message.substring(0, 200) + '...';
  }
  
  return {
    message: message || defaultError.message,
    statusCode: defaultError.statusCode,
  };
}

export function logSensitiveError(error: any, context?: string): void {
  // In production, this would send to a secure logging service
  // For now, we'll use console.error but mark it as sensitive
  if (process.env.NODE_ENV === 'development') {
    console.error('[SENSITIVE ERROR]', context || '', error);
  } else {
    // In production, only log sanitized version
    const sanitized = sanitizeDatabaseError(error);
    console.error('[ERROR]', context || '', sanitized.message);
  }
}

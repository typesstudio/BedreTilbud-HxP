/**
 * Retry utility with exponential backoff
 * 
 * Retries a function with exponential backoff for transient failures.
 * Useful for API calls to external services (OpenAI, Mistral, etc.)
 */

interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[]; // Error messages that should trigger retry
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT', 
    'ENOTFOUND',
    'rate_limit',
    'timeout',
    '429',
    '503',
    '500',
    'Internal Server Error'
  ]
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any, retryableErrors: string[]): boolean {
  if (!error) return false;
  
  const errorString = JSON.stringify(error).toLowerCase();
  const errorMessage = (error.message || '').toLowerCase();
  const errorCode = (error.code || '').toLowerCase();
  
  return retryableErrors.some(pattern => 
    errorString.includes(pattern.toLowerCase()) ||
    errorMessage.includes(pattern.toLowerCase()) ||
    errorCode.includes(pattern.toLowerCase())
  );
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - Async function to retry
 * @param options - Retry configuration
 * @returns Result of the function
 * @throws Last error if all retries fail
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let attempt = 0;

  while (attempt < opts.maxAttempts) {
    try {
      attempt++;
      
      if (attempt > 1) {
        console.log(`[Retry] Attempt ${attempt}/${opts.maxAttempts}`);
      }
      
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if we should retry
      const shouldRetry = isRetryableError(error, opts.retryableErrors);
      const isLastAttempt = attempt >= opts.maxAttempts;
      
      if (!shouldRetry || isLastAttempt) {
        console.error(`[Retry] Failed after ${attempt} attempt(s):`, error.message);
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelayMs
      );

      console.warn(`[Retry] Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Retry specifically for AI API calls (OpenAI, Mistral)
 * Pre-configured with AI-specific retry settings
 */
export async function retryAICall<T>(
  fn: () => Promise<T>,
  operationName: string = 'AI operation'
): Promise<T> {
  return retryWithBackoff(fn, {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 8000,
    retryableErrors: [
      'rate_limit_exceeded',
      'timeout',
      'network',
      'ECONNRESET',
      'ETIMEDOUT',
      '429',
      '503',
      '500',
      'Internal Server Error',
      'overloaded'
    ]
  });
}

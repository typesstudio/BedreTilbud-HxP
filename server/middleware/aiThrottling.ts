// AI Request Throttling - prevents excessive API costs

interface AIRequestTracker {
  count: number;
  resetAt: number;
  totalCost: number;
}

// Track AI requests per user
const userAIRequests = new Map<string, AIRequestTracker>();

// Limits
const HOURLY_REQUEST_LIMIT = 50; // Max AI requests per user per hour
const DAILY_COST_LIMIT = 10.0; // Max $10 AI cost per user per day (USD)

// Cost estimates (USD per request)
const AI_COSTS = {
  'mistral-ocr': 0.10,      // OCR is expensive
  'mistral-chat': 0.01,     // Chat is cheap
  'openai-gpt-4o-mini': 0.02, // Very cost-effective
  'comparison': 0.03,       // Multiple calls
  'email-generation': 0.01,
};

function getOrCreateTracker(userId: string): AIRequestTracker {
  let tracker = userAIRequests.get(userId);
  
  if (!tracker || tracker.resetAt < Date.now()) {
    tracker = {
      count: 0,
      resetAt: Date.now() + (60 * 60 * 1000), // Reset every hour
      totalCost: 0,
    };
    userAIRequests.set(userId, tracker);
  }
  
  return tracker;
}

export function checkAIQuota(
  userId: string,
  operation: keyof typeof AI_COSTS
): { allowed: boolean; reason?: string; remaining?: number } {
  const tracker = getOrCreateTracker(userId);
  const estimatedCost = AI_COSTS[operation] || 0.05;
  
  // Check request count limit
  if (tracker.count >= HOURLY_REQUEST_LIMIT) {
    const minutesUntilReset = Math.ceil((tracker.resetAt - Date.now()) / (60 * 1000));
    return {
      allowed: false,
      reason: `AI request limit reached. Resets in ${minutesUntilReset} minutes.`,
      remaining: 0,
    };
  }
  
  // Check cost limit
  if (tracker.totalCost + estimatedCost > DAILY_COST_LIMIT) {
    return {
      allowed: false,
      reason: 'Daily AI cost limit reached. Please try again tomorrow.',
      remaining: 0,
    };
  }
  
  return {
    allowed: true,
    remaining: HOURLY_REQUEST_LIMIT - tracker.count,
  };
}

export function recordAIUsage(
  userId: string,
  operation: keyof typeof AI_COSTS,
  actualCost?: number
): void {
  const tracker = getOrCreateTracker(userId);
  const cost = actualCost || AI_COSTS[operation] || 0.05;
  
  tracker.count++;
  tracker.totalCost += cost;
  
  userAIRequests.set(userId, tracker);
}

export function getAIUsageStats(userId: string): {
  requestsUsed: number;
  requestsRemaining: number;
  estimatedCost: number;
  resetAt: Date;
} {
  const tracker = getOrCreateTracker(userId);
  
  return {
    requestsUsed: tracker.count,
    requestsRemaining: Math.max(0, HOURLY_REQUEST_LIMIT - tracker.count),
    estimatedCost: tracker.totalCost,
    resetAt: new Date(tracker.resetAt),
  };
}

// Clean up old trackers every hour
setInterval(() => {
  const now = Date.now();
  for (const [userId, tracker] of Array.from(userAIRequests.entries())) {
    if (tracker.resetAt < now) {
      userAIRequests.delete(userId);
    }
  }
}, 60 * 60 * 1000);

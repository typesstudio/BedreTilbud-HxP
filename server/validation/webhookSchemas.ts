import { z } from 'zod';

/**
 * Zod validation schemas for webhook payloads
 * These ensure incoming data matches expected structure before persisting
 */

/**
 * Health check coverage item
 */
const coverageItemSchema = z.object({
  name: z.string(),
  amount: z.number().nullable().optional(),
  amountLabel: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  included: z.boolean().optional(),
  deductible: z.string().nullable().optional(),
});

/**
 * Health check strength item
 */
const strengthSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  variant: z.enum(['success', 'neutral']).optional(),
});

/**
 * Health check weakness item
 */
const weaknessSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  severity: z.enum(['warning', 'error']).optional(),
  variant: z.enum(['warning', 'error']).optional(),
});

/**
 * Schema for pre-computed health check JSON
 * Validates webhook payload for /api/webhooks/health-check
 */
export const healthCheckJsonSchema = z.object({
  score: z.number().min(0).max(100),
  statusLabel: z.string().optional(),
  annualPremium: z.number().nonnegative().optional(),
  potentialSavingsAnnual: z.number().optional(),
  strengths: z.array(strengthSchema).optional().default([]),
  weaknesses: z.array(weaknessSchema).optional().default([]),
  coverages: z.array(coverageItemSchema).optional().default([]),
  tenYearSavings: z.array(z.object({
    year: z.number(),
    cumulativeSavings: z.number(),
  })).optional(),
  cumulativeSavings: z.object({
    after12Months: z.number(),
    after3Years: z.number(),
    after5Years: z.number(),
    after10Years: z.number(),
  }).optional(),
  benchmark: z.object({
    averagePremium: z.number(),
    percentile: z.number(),
    isAboveAverage: z.boolean(),
  }).optional(),
  version: z.string().optional(),
  computedAt: z.string().optional(),
}).passthrough(); // Allow additional fields for flexibility

/**
 * Schema for the full health check webhook request body
 */
export const healthCheckWebhookBodySchema = z.object({
  policySnapshotId: z.string().uuid(),
  healthCheckJson: healthCheckJsonSchema,
});

/**
 * Coverage comparison status
 */
const coverageStatusSchema = z.enum(['better', 'worse', 'equal', 'different']).optional();

/**
 * Coverage comparison detail
 */
const coverageComparisonSchema = z.object({
  name: z.string(),
  current: z.object({
    included: z.boolean(),
    amount: z.number().nullable().optional(),
    amountLabel: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    deductible: z.string().nullable().optional(),
  }).optional(),
  offer: z.object({
    included: z.boolean(),
    amount: z.number().nullable().optional(),
    amountLabel: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    deductible: z.string().nullable().optional(),
  }).optional(),
  status: coverageStatusSchema,
});

/**
 * Schema for pre-computed comparison JSON
 * Validates webhook payload for /api/webhooks/comparison
 */
export const comparisonJsonSchema = z.object({
  summary: z.object({
    annualCurrent: z.number().nonnegative(),
    annualOffer: z.number().nonnegative(),
    annualSavings: z.number(),
    savingsPercent: z.number(),
  }).optional(),
  highlights: z.array(z.string()).optional().default([]),
  coverages: z.array(coverageComparisonSchema).optional().default([]),
  tenYearProjection: z.array(z.object({
    year: z.number(),
    cumulativeSavings: z.number(),
  })).optional(),
  policyBreakdown: z.array(z.object({
    policyType: z.string(),
    policyLabel: z.string(),
    currentPremium: z.number(),
    offerPremium: z.number(),
    savings: z.number(),
    recommendation: z.enum(['switch', 'keep', 'review']).optional(),
  })).optional(),
  meta: z.object({
    pricingStatus: z.enum(['complete', 'partial', 'missing']).optional(),
    computedAt: z.string().optional(),
    version: z.string().optional(),
  }).optional(),
}).passthrough(); // Allow additional fields for flexibility

/**
 * Schema for the full comparison webhook request body
 */
export const comparisonWebhookBodySchema = z.object({
  comparisonId: z.string().uuid(),
  comparisonJson: comparisonJsonSchema,
});

import OpenAI from "openai";
import { loadPrompt, replaceVariables } from "../ai-prompts/utils/promptLoader";
import { retryAICall } from "../utils/retry";
import type { PolicyPricing } from "../types/pricing";
import { PolicyPricingSchema } from "../types/pricing";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000,
  maxRetries: 2,
});

export interface PricingAgentInput {
  policyType: string;
  companyName: string | null;
  currency: "DKK";
  rawText: string;
}

/**
 * Sanity check: Verify that the extracted annual premium is plausible for the policy type.
 * This prevents obviously wrong prices (e.g., mixing up ulykke 995 kr with fritidshus 5682 kr).
 * 
 * Returns true if the price is plausible, false if it's suspiciously wrong.
 */
function isPlausibleAnnualPremium(policyType: string, amount: number): { plausible: boolean; reason?: string } {
  const type = policyType.toLowerCase();
  
  // House/summer house insurance: typically 2,000 - 30,000 kr/year
  if (['hus', 'fritidshus', 'villa', 'sommerhus', 'husforsikring'].includes(type)) {
    if (amount < 1500) {
      return { plausible: false, reason: `${type} premium ${amount} kr is suspiciously low (expected 1,500-30,000 kr)` };
    }
    if (amount > 50000) {
      return { plausible: false, reason: `${type} premium ${amount} kr is suspiciously high (expected 1,500-30,000 kr)` };
    }
    return { plausible: true };
  }
  
  // Contents insurance: typically 300 - 5,000 kr/year
  if (['indbo', 'indboforsikring'].includes(type)) {
    if (amount < 200) {
      return { plausible: false, reason: `${type} premium ${amount} kr is suspiciously low (expected 300-5,000 kr)` };
    }
    if (amount > 15000) {
      return { plausible: false, reason: `${type} premium ${amount} kr is suspiciously high (expected 300-15,000 kr)` };
    }
    return { plausible: true };
  }
  
  // Accident insurance: typically 200 - 3,000 kr/year
  if (['ulykke', 'ulykkesforsikring'].includes(type)) {
    if (amount < 100) {
      return { plausible: false, reason: `${type} premium ${amount} kr is suspiciously low (expected 200-3,000 kr)` };
    }
    if (amount > 10000) {
      return { plausible: false, reason: `${type} premium ${amount} kr is suspiciously high (expected 200-10,000 kr)` };
    }
    return { plausible: true };
  }
  
  // Car insurance: typically 2,000 - 20,000 kr/year
  if (['bil', 'bilforsikring', 'auto'].includes(type)) {
    if (amount < 1000) {
      return { plausible: false, reason: `${type} premium ${amount} kr is suspiciously low (expected 2,000-20,000 kr)` };
    }
    if (amount > 40000) {
      return { plausible: false, reason: `${type} premium ${amount} kr is suspiciously high (expected 2,000-40,000 kr)` };
    }
    return { plausible: true };
  }
  
  // Travel insurance: typically 200 - 3,000 kr/year
  if (['rejse', 'rejseforsikring'].includes(type)) {
    if (amount < 100) {
      return { plausible: false, reason: `${type} premium ${amount} kr is suspiciously low (expected 200-3,000 kr)` };
    }
    if (amount > 10000) {
      return { plausible: false, reason: `${type} premium ${amount} kr is suspiciously high (expected 200-10,000 kr)` };
    }
    return { plausible: true };
  }
  
  // Unknown policy type - accept any reasonable positive amount
  if (amount < 50) {
    return { plausible: false, reason: `Premium ${amount} kr is suspiciously low for any insurance type` };
  }
  if (amount > 100000) {
    return { plausible: false, reason: `Premium ${amount} kr is suspiciously high for any insurance type` };
  }
  
  return { plausible: true };
}

/**
 * Phase 1b: PricingAgent
 * 
 * Extracts and normalizes pricing information from a policy text segment.
 * This service provides robust, AI-powered pricing extraction to replace brittle regex logic.
 * 
 * Key Features:
 * - Identifies all price expressions in the text
 * - Normalizes to annual premium (DKK)
 * - Detects package vs per-policy pricing
 * - Handles intro prices, binding periods, and frequency conversion
 * - Returns null (never 0) when pricing is unclear
 * 
 * Output is attached to structuredPolicy.pricing for use in comparison logic.
 */
class PolicyPricingService {
  /**
   * Extracts pricing information from policy text segment.
   * 
   * @param input - Policy type, company name, currency, and raw text
   * @returns PolicyPricing object with annualPremium and metadata
   */
  async extractPricingForPolicy(input: PricingAgentInput): Promise<PolicyPricing> {
    try {
      console.log(`[PricingAgent] Starting pricing extraction for ${input.policyType} (${input.rawText.length} chars)`);
      
      const systemPrompt = loadPrompt('extraction/policy-pricing');
      const userPayload = JSON.stringify({
        policyType: input.policyType,
        companyName: input.companyName,
        currency: input.currency,
        rawText: input.rawText
      }, null, 2);

      // Use gpt-4o for robust pricing extraction
      const response = await retryAICall(async () => {
        return await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: userPayload
            }
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 2000,
          temperature: 0.1, // Low temperature for deterministic pricing
        });
      }, 'pricing-extraction');

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      // ========================================
      // ZOD VALIDATION: Reject AI response if schema doesn't match
      // ========================================
      
      // Force extractionVersion before validation
      if (!result.extractionVersion) {
        result.extractionVersion = "pricing_agent_v1";
      }

      // Validate AI response against PolicyPricing schema
      const validationResult = PolicyPricingSchema.safeParse(result);

      if (!validationResult.success) {
        // Validation failed - log detailed error and return explicit failure
        const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        console.error(`[PricingAgent] ❌ Schema validation failed for ${input.policyType}:`, errors);
        console.error(`[PricingAgent] Raw AI output:`, JSON.stringify(result, null, 2));
        
        throw new Error(`Schema validation failed: ${errors}`);
      }

      // Schema validation passed - use the validated data
      const pricing = validationResult.data;

      // Additional post-validation checks
      // CRITICAL: Never accept 0 or negative as a valid annualPremium
      if (pricing.annualPremium !== null && pricing.annualPremium <= 0) {
        console.warn(`[PricingAgent] ⚠️ AI returned annualPremium=${pricing.annualPremium}, converting to null`);
        pricing.annualPremium = null;
        if (pricing.pricingStatus === "ok") {
          pricing.pricingStatus = "unknown";
        }
      }

      // ========================================
      // SANITY CHECK: Reject implausible prices (Dec 2025 Fix)
      // This catches cases where AI extracted wrong price from wrong section
      // ========================================
      if (pricing.annualPremium !== null) {
        const sanityCheck = isPlausibleAnnualPremium(input.policyType, pricing.annualPremium);
        if (!sanityCheck.plausible) {
          console.warn(`[PricingAgent] ⚠️ SANITY CHECK FAILED for ${input.policyType}: ${sanityCheck.reason}`);
          console.warn(`[PricingAgent] Rejecting implausible price ${pricing.annualPremium} kr, setting to null`);
          
          // Preserve the original value in notes for debugging
          const originalNotes = pricing.notes || '';
          pricing.notes = `SANITY_CHECK_FAILED: ${sanityCheck.reason}. Original AI output: annualPremium=${pricing.annualPremium}. ${originalNotes}`;
          
          // Set price to null and mark as needs_review
          pricing.annualPremium = null;
          pricing.pricingStatus = "needs_manual_review";
          pricing.pricingConfidence = 20; // Low confidence
        }
      }

      console.log(`[PricingAgent] ✅ Extracted pricing for ${input.policyType}:`, {
        status: pricing.pricingStatus,
        annualPremium: pricing.annualPremium,
        confidence: pricing.pricingConfidence,
        rawPricesCount: pricing.rawPrices.length
      });

      return pricing;
    } catch (error) {
      console.error(`[PricingAgent] ❌ Extraction failed for ${input.policyType}:`, error);
      
      // Fallback: return "unknown" pricing (never fail the entire extraction)
      return {
        pricingStatus: "unknown",
        pricingConfidence: 0,
        annualPremium: null,
        billingFrequency: "unknown",
        rawPrices: [],
        bindingMonths: null,
        hasIntroPrice: false,
        introPeriodMonths: null,
        introAnnualPremium: null,
        postBindingIncreasePercent: null,
        notes: `PricingAgent failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        extractionVersion: "pricing_agent_v1"
      };
    }
  }
}

export const policyPricingService = new PolicyPricingService();

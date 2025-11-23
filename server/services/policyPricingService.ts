import OpenAI from "openai";
import { loadPrompt, replaceVariables } from "../ai-prompts/utils/promptLoader";
import { retryAICall } from "../utils/retry";
import type { PolicyPricing } from "../types/pricing";

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
      
      // Validation & safety checks
      if (!result || typeof result !== "object") {
        throw new Error("Empty pricing result from AI");
      }

      // CRITICAL: Never accept 0 as a valid annualPremium unless explicitly intended
      if (
        typeof result.annualPremium === "number" &&
        result.annualPremium <= 0
      ) {
        console.warn(`[PricingAgent] ⚠️ AI returned annualPremium=${result.annualPremium}, converting to null`);
        result.annualPremium = null;
        if (result.pricingStatus === "ok") {
          result.pricingStatus = "unknown";
        }
      }

      // Force extractionVersion to ensure tracking
      result.extractionVersion = "pricing_agent_v1";

      // Ensure all required fields exist with defaults
      const pricing: PolicyPricing = {
        pricingStatus: result.pricingStatus || "unknown",
        pricingConfidence: result.pricingConfidence || 0,
        annualPremium: result.annualPremium ?? null,
        billingFrequency: result.billingFrequency || "unknown",
        rawPrices: result.rawPrices || [],
        bindingMonths: result.bindingMonths ?? null,
        hasIntroPrice: result.hasIntroPrice || false,
        introPeriodMonths: result.introPeriodMonths ?? null,
        introAnnualPremium: result.introAnnualPremium ?? null,
        postBindingIncreasePercent: result.postBindingIncreasePercent ?? null,
        notes: result.notes || "No notes provided",
        extractionVersion: "pricing_agent_v1"
      };

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

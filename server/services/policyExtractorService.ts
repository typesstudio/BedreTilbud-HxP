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

export interface Coverage {
  name: string;
  limit: string | null;
  deductible: string | null;
  included: boolean;
  sourceTable: string | null;
}

export interface StructuredPolicy {
  policyType: "hus" | "indbo" | "ulykke" | "bil" | "rejse" | "andet";
  policyName: string;
  company: string;
  offerNumber: string | null;
  address: string | null;
  annualPremium: number | null;
  defaultDeductible: string | null;
  coverageDetails: {
    mainCoverages: Coverage[];
    additionalCoverages: Coverage[];
  };
  meta: {
    rawPolicyTypeLabel: string | null;
    indexYear: string | null;
  };
  pricing?: PolicyPricing; // NEW: PricingAgent output
}

export interface PolicyExtractorResult {
  policies: StructuredPolicy[];
}

/**
 * Phase 1: PolicyExtractor
 * 
 * Converts OCR markdown text into structured policy JSON.
 * This is a pure extraction phase - no opinions, no analysis, just deterministic mapping.
 * 
 * Key Features:
 * - Preserves exact deductible/limit values as strings (e.g., "2.834 kr", "5.000 kr")
 * - Converts annual premiums to numbers for computation
 * - Extracts mainCoverages from "Dækning | Selvrisiko" tables
 * - Extracts additionalCoverages from "Tilvalg" sections
 * - Stores output in offer_snapshots.structuredPolicy for Phase 2 reprocessing
 */
class PolicyExtractorService {
  /**
   * Extracts structured policy JSON from OCR markdown text.
   * 
   * @param rawOcrMarkdown - Raw OCR text from Mistral OCR (markdown format)
   * @returns PolicyExtractorResult with array of structured policies
   */
  async extractPolicies(rawOcrMarkdown: string): Promise<PolicyExtractorResult> {
    try {
      console.log(`[PolicyExtractor] Starting Phase 1 extraction (${rawOcrMarkdown.length} chars)`);
      
      const promptTemplate = loadPrompt('extraction/policy-extractor');
      const prompt = replaceVariables(promptTemplate, {
        rawOcrMarkdown
      });

      // Use gpt-4o for high-quality extraction with reasoning
      const response = await retryAICall(async () => {
        return await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are an expert Danish insurance parsing engine. Extract policies with perfect accuracy. ONLY return valid JSON."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 8000,
        });
      }, 'policy-extraction-phase1');

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      // Validation: ensure policies array exists
      if (!result.policies || !Array.isArray(result.policies)) {
        throw new Error("Invalid extraction result: missing policies array");
      }

      console.log(`[PolicyExtractor] ✅ Extracted ${result.policies.length} policies`);
      
      // Log coverage counts for debugging
      result.policies.forEach((policy: StructuredPolicy, idx: number) => {
        const mainCount = policy.coverageDetails?.mainCoverages?.length || 0;
        const additionalCount = policy.coverageDetails?.additionalCoverages?.length || 0;
        console.log(`[PolicyExtractor] Policy ${idx + 1} (${policy.policyType}): ${mainCount} main + ${additionalCount} additional coverages`);
      });

      return result as PolicyExtractorResult;
    } catch (error) {
      console.error("[PolicyExtractor] Extraction failed:", error);
      throw new Error(`Phase 1 extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates that extracted policies have required fields for Phase 2.
   * 
   * @param policy - Structured policy from Phase 1
   * @returns Validation errors (empty array if valid)
   */
  validatePolicy(policy: StructuredPolicy): string[] {
    const errors: string[] = [];

    if (!policy.policyType) {
      errors.push("Missing policyType");
    }

    if (!policy.policyName) {
      errors.push("Missing policyName");
    }

    if (!policy.coverageDetails) {
      errors.push("Missing coverageDetails");
    } else {
      if (!Array.isArray(policy.coverageDetails.mainCoverages)) {
        errors.push("Missing mainCoverages array");
      }
      
      if (!Array.isArray(policy.coverageDetails.additionalCoverages)) {
        errors.push("Missing additionalCoverages array");
      }

      // Validate each coverage has required fields
      [...(policy.coverageDetails.mainCoverages || []), ...(policy.coverageDetails.additionalCoverages || [])].forEach((coverage, idx) => {
        if (!coverage.name) {
          errors.push(`Coverage ${idx} missing name`);
        }
      });
    }

    return errors;
  }
}

export const policyExtractorService = new PolicyExtractorService();

import OpenAI from "openai";
import { AIComparisonNarrative, aiComparisonNarrativeSchema } from "@shared/schema";
import { retryAICall } from "../utils/retry";
import { loadPrompt, replaceVariables } from "../ai-prompts/utils/promptLoader";
import { fromZodError } from "zod-validation-error";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000, // 2 minute timeout for comparison operations (larger than health check)
  maxRetries: 2,
});

/**
 * ENRICHMENT PATTERN INPUT
 * Only send health check data and identity fields to AI
 * DO NOT send coverage rows, highlights, or cost summaries - those are deterministic
 */
interface PolicyForNarrative {
  policyKey: string; // Simple slot key (e.g. "policy-1") for AI to echo back - easy for models to copy
  policyType: string;
  label: string;
  currentCompany: string;
  offerCompany: string;
  healthCheckData: {
    current: any; // Health check result for current policy
    offer: any;   // Health check result for offer policy
  };
}

interface ComparisonAgentInput {
  context: {
    currentCompany: string;
    offerCompany: string;
    currency: string;
  };
  policies: PolicyForNarrative[]; // Minimal data - just health checks for AI to analyze
}

function logAIInvocation(
  operation: string,
  metadata: {
    model: string;
    tokensUsed?: number;
    costUsd?: number;
    latencyMs?: number;
  }
) {
  console.log(
    `[AI Invocation] ${operation} | Model: ${metadata.model} | ` +
    `Tokens: ${metadata.tokensUsed || 'N/A'} | Cost: $${metadata.costUsd?.toFixed(4) || 'N/A'} | ` +
    `Latency: ${metadata.latencyMs || 'N/A'}ms`
  );
}

/**
 * Estimates cost based on model and token usage.
 * Prices as of Nov 2024: gpt-4o $5/$15 per M tokens, gpt-4o-mini $0.15/$0.60 per M tokens
 */
function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const prices: Record<string, { input: number; output: number }> = {
    "gpt-4o": { input: 5 / 1_000_000, output: 15 / 1_000_000 },
    "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
  };

  const price = prices[model] || prices["gpt-4o-mini"];
  return promptTokens * price.input + completionTokens * price.output;
}

/**
 * Phase 4: ComparisonAgent (ENRICHMENT PATTERN)
 * 
 * ROLE: Generate ONLY narrative fields (analysis, recommendations, missing info)
 * NO LONGER GENERATES: Coverage rows, highlights, cost summaries (those are deterministic)
 * 
 * Pattern:
 * - INPUT: Health check data + identity fields only
 * - OUTPUT: Narrative analysis (explanation, recommendations, missing information)
 * - ORCHESTRATOR: Merges AI narratives with deterministic data
 * 
 * Benefits:
 * - 100% preservation of deterministic data (AI can't modify what it doesn't see)
 * - Faster AI calls (smaller prompts)
 * - Better narratives (AI focuses on what it's good at: writing, not copying)
 */
export class ComparisonAgentService {
  private systemPrompt: string;
  private userPromptTemplate: string;

  constructor() {
    this.systemPrompt = loadPrompt("comparison/system");
    this.userPromptTemplate = loadPrompt("comparison/user");
  }

  /**
   * Generate narrative-only comparison analysis
   * Returns ONLY the AI-generated text (not coverage rows or highlights)
   */
  async generateNarrative(input: ComparisonAgentInput): Promise<AIComparisonNarrative> {
    console.log(
      `[ComparisonAgent] Generating narratives for: ${input.context.currentCompany} vs ${input.context.offerCompany}`,
      `(${input.policies.length} policies)`
    );

    const startTime = Date.now();

    // Extract policyKeys for validation (prevent hallucination/omission)
    const expectedKeys = input.policies.map(p => p.policyKey);
    const expectedPolicyTypes = input.policies.map(p => p.policyType);
    console.log(`[ComparisonAgent] Expected ${expectedKeys.length} policies with keys: ${expectedKeys.join(', ')}`);
    console.log(`[ComparisonAgent] Policy types: ${expectedPolicyTypes.join(', ')}`);

    // TRY 1: Standard prompt
    try {
      return await this.attemptNarrativeGeneration(input, expectedKeys, false);
    } catch (error: any) {
      // RETRY: If AI omitted policies, try again with reinforced prompt
      if (error.message?.includes('AI omitted required')) {
        console.warn(`[ComparisonAgent] ⚠️  First attempt failed (${error.message}), retrying with reinforced prompt...`);
        return await this.attemptNarrativeGeneration(input, expectedKeys, true);
      }
      // For other errors, fail immediately
      throw error;
    }
  }

  private async attemptNarrativeGeneration(
    input: ComparisonAgentInput,
    expectedKeys: string[],
    reinforcePrompt: boolean
  ): Promise<AIComparisonNarrative> {
    const startTime = Date.now();

    const expectedPolicyTypes = input.policies.map(p => p.policyType).join(', ');

    let userPrompt = replaceVariables(this.userPromptTemplate, {
      policiesJSON: JSON.stringify(input.policies, null, 2),
      context: JSON.stringify(input.context, null, 2),
      expectedPolicyTypes: expectedPolicyTypes
    });

    // Add reinforcement on retry
    if (reinforcePrompt) {
      userPrompt = `⚠️ CRITICAL REMINDER: You MUST return narratives with EXACTLY ${expectedKeys.length} policyKeys (${expectedKeys.join(', ')}). Do NOT omit any policies!\n\n` + userPrompt;
    }

    const aiResponse = await this.callComparisonAgent(userPrompt);
    const latencyMs = Date.now() - startTime;

    console.log(`[ComparisonAgent] AI call completed in ${latencyMs}ms ${reinforcePrompt ? '(retry)' : ''}`);

    let parsedResult: AIComparisonNarrative;
    try {
      parsedResult = aiComparisonNarrativeSchema.parse(aiResponse.result);
      console.log("[ComparisonAgent] ✅ Narrative schema validation passed");
      
      // DEBUG: Log narrative counts returned by AI
      const narrativeCounts = parsedResult.policyNarratives.map(pn => ({
        type: pn.policyType,
        recommendations: pn.recommendations.length,
        missingInfo: pn.missingInformation.length
      }));
      console.log("[ComparisonAgent] DEBUG: AI returned narratives:", JSON.stringify(narrativeCounts));
    } catch (error: any) {
      const validationError = fromZodError(error);
      console.error("[ComparisonAgent] ❌ Narrative schema validation failed:", validationError.message);
      throw new Error(`ComparisonAgent narrative validation failed: ${validationError.message}`);
    }

    // Validate output matches expected policyKeys (prevent hallucination)
    this.validateNarrativeResult(parsedResult, expectedKeys);

    logAIInvocation("ComparisonAgent (Narrative)" + (reinforcePrompt ? " (retry)" : ""), {
      model: aiResponse.model,
      tokensUsed: aiResponse.tokensUsed,
      costUsd: aiResponse.costUsd,
      latencyMs,
    });

    return parsedResult;
  }

  /**
   * Validates that AI narratives respect input constraints
   * Prevents hallucination or omission of policies using simple policyKeys
   */
  private validateNarrativeResult(result: AIComparisonNarrative, expectedKeys: string[]): void {
    const outputKeys = result.policyNarratives.map(pn => pn.policyKey);
    
    // Check for hallucinated keys
    const hallucinated = outputKeys.filter(key => !expectedKeys.includes(key));
    if (hallucinated.length > 0) {
      console.error(
        `[ComparisonAgent] ❌ HALLUCINATION DETECTED: AI added unexpected policyKeys:`,
        hallucinated.join(', '),
        `| Expected: ${expectedKeys.join(', ')}`
      );
      throw new Error(
        `AI hallucinated policyKeys: ${hallucinated.join(', ')}. ` +
        `Only expected: ${expectedKeys.join(', ')}`
      );
    }

    // Check for missing keys - STRICT VALIDATION
    const missing = expectedKeys.filter(key => !outputKeys.includes(key));
    if (missing.length > 0) {
      const errorMsg = `AI omitted required policyKeys: ${missing.join(', ')}. Input had ${expectedKeys.length} policies, output has ${outputKeys.length} narratives.`;
      console.error(`[ComparisonAgent] ❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.log(`[ComparisonAgent] ✅ Narrative validation passed: All ${expectedKeys.length} policyKeys matched`);
  }

  private async callComparisonAgent(userPrompt: string): Promise<{
    result: any;
    model: string;
    tokensUsed: number;
    costUsd: number;
  }> {
    const primaryModel = "gpt-4o";
    const fallbackModel = "gpt-4o-mini";

    try {
      return await this.invokeModel(primaryModel, userPrompt);
    } catch (primaryError: any) {
      console.warn(
        `[ComparisonAgent] Primary model ${primaryModel} failed:`,
        primaryError.message,
        "Falling back to",
        fallbackModel
      );
      
      try {
        return await this.invokeModel(fallbackModel, userPrompt);
      } catch (fallbackError: any) {
        console.error(
          `[ComparisonAgent] Fallback model ${fallbackModel} also failed:`,
          fallbackError.message
        );
        throw new Error(
          `ComparisonAgent failed with both models: ${primaryError.message} | ${fallbackError.message}`
        );
      }
    }
  }

  private async invokeModel(model: string, userPrompt: string): Promise<{
    result: any;
    model: string;
    tokensUsed: number;
    costUsd: number;
  }> {
    console.log(`[ComparisonAgent] Invoking ${model}...`);

    const completion = await retryAICall(
      async () =>
        await openai.chat.completions.create({
          model,
          messages: [
            { role: "system", content: this.systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
      `ComparisonAgent-${model}`
    );

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from ComparisonAgent");
    }

    let result: any;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error("[ComparisonAgent] Failed to parse JSON response:", content.substring(0, 500));
      throw new Error("ComparisonAgent returned invalid JSON");
    }

    const promptTokens = completion.usage?.prompt_tokens || 0;
    const completionTokens = completion.usage?.completion_tokens || 0;
    const tokensUsed = promptTokens + completionTokens;
    const costUsd = estimateCost(model, promptTokens, completionTokens);

    return {
      result,
      model,
      tokensUsed,
      costUsd,
    };
  }
}

export const comparisonAgentService = new ComparisonAgentService();

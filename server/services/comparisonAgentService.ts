import OpenAI from "openai";
import { ComparisonResult, comparisonResultSchema } from "@shared/schema";
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

interface PolicyPairInput {
  policyType: string;
  label: string;
  current: {
    policyId: string;
    annualPremium: number;
    healthCheck: any;
  };
  offer: {
    policyId: string;
    annualPremium: number;
    healthCheck: any;
  };
}

interface ComparisonAgentInput {
  context: {
    currentCompany: string;
    offerCompany: string;
    currency: string;
  };
  policyPairs: PolicyPairInput[];
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
 * Phase 4: ComparisonAgent
 * 
 * Takes matched policy pairs with their health checks and generates comprehensive
 * comparison JSON for the UI (Samlet tab + per-policy tabs).
 * 
 * Mirrors HealthCheckAnalyst pattern:
 * - Loads prompts from ai-prompts/comparison/
 * - Uses gpt-4o with fallback to gpt-4o-mini
 * - Validates output with Zod schema
 * - Tracks costs and latency
 */
export class ComparisonAgentService {
  private systemPrompt: string;
  private userPromptTemplate: string;

  constructor() {
    this.systemPrompt = loadPrompt("comparison/system");
    this.userPromptTemplate = loadPrompt("comparison/user");
  }

  async generateComparison(input: ComparisonAgentInput): Promise<ComparisonResult> {
    console.log(
      `[ComparisonAgent] Starting comparison: ${input.context.currentCompany} vs ${input.context.offerCompany}`,
      `(${input.policyPairs.length} pairs)`
    );

    const startTime = Date.now();

    const userPrompt = replaceVariables(this.userPromptTemplate, {
      policyPairsJSON: JSON.stringify(input, null, 2),
    });

    const aiResponse = await this.callComparisonAgent(userPrompt);
    const latencyMs = Date.now() - startTime;

    console.log(`[ComparisonAgent] AI call completed in ${latencyMs}ms`);

    let parsedResult: ComparisonResult;
    try {
      parsedResult = comparisonResultSchema.parse(aiResponse.result);
      console.log("[ComparisonAgent] ✅ Output schema validation passed");
    } catch (error: any) {
      const validationError = fromZodError(error);
      console.error("[ComparisonAgent] ❌ Output schema validation failed:", validationError.message);
      throw new Error(`ComparisonAgent output validation failed: ${validationError.message}`);
    }

    logAIInvocation("ComparisonAgent", {
      model: aiResponse.model,
      tokensUsed: aiResponse.tokensUsed,
      costUsd: aiResponse.costUsd,
      latencyMs,
    });

    return parsedResult;
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
      {
        maxRetries: 3,
        delayMs: 2000,
        operationName: `ComparisonAgent-${model}`,
      }
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

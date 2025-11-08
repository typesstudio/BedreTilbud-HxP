import OpenAI from "openai";
import { InsuranceData } from "./mistralOcrService";
import { Policy } from "../../shared/schema";
import { retryAICall } from "../utils/retry";
import { loadPrompt, replaceVariables } from "../ai-prompts/utils/promptLoader";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000, // 60 second timeout for AI operations
  maxRetries: 2, // Retry failed requests up to 2 times
});

// Track AI usage for cost monitoring
function logAIUsage(provider: string, operation: string, success: boolean) {
  console.log(`[AI Usage] ${provider} - ${operation} - ${success ? 'Success' : 'Failed'}`);
}

export interface HealthCheckResult {
  overallScore: number;
  scoreExplanation: string;
  annualSavings: {
    amount: number;
    percentageLower: number;
    explanation: string;
  };
  highlights: Array<{
    title: string;
    description: string;
    icon: string;
    variant: string;
  }>;
  whatsIncluded: Array<{
    coverage: string;
    description: string;
    value: string;
    status: string;
  }>;
  keyFigures: Array<{
    label: string;
    icon: string;
    currentValue: string;
    newValue: string;
    variant: string;
  }>;
  missingInformation: {
    totalIssues: number;
    criticalCount: number;
    categories: Array<{
      name: string;
      icon: string;
      criticalCount: number;
      importantCount: number;
      questionsCount: number;
      items: Array<{
        title: string;
        description?: string;
        severity: string;
        response?: string;
      }>;
    }>;
  };
  cumulativeSavings: {
    totalOver10Years: number;
    monthlyRange: {
      min: number;
      max: number;
    };
    after12Months: number;
    after10Years: number;
    chartData: Array<{
      month: string;
      savings: number;
    }>;
  };
  potentialSavings: {
    conservative: number;
    realistic: number;
    optimistic: number;
    explanation: string;
  };
  strengths: Array<{
    title: string;
    description: string;
    icon: string;
    variant: string;
  }>;
  weaknesses: Array<{
    title: string;
    description: string;
    icon: string;
    variant: string;
    severity: string;
  }>;
  coverageGaps: {
    categories: Array<{
      name: string;
      icon: string;
      items: Array<{
        title: string;
        description: string;
        severity: string;
        estimatedCost?: number;
        potentialSaving?: number;
      }>;
    }>;
  };
  marketComparison: Array<{
    category: string;
    current: string;
    marketAverage: string;
    difference: string;
    status: string;
  }>;
  recommendations: Array<{
    priority: number;
    title: string;
    description: string;
    estimatedImpact: string;
  }>;
}

class InsuranceCheckService {
  async analyzeInsuranceHealth(policy: Policy): Promise<HealthCheckResult> {
    try {
      const coverageDetails = policy.coverageDetails as any;
      const policyType = policy.policyType || 'home';
      
      const promptTemplate = loadPrompt('health-check/analysis');
      const prompt = replaceVariables(promptTemplate, {
        policyType,
        premium: policy.premium || 'N/A',
        deductible: policy.deductible || 'N/A',
        coverageDetails: JSON.stringify(coverageDetails, null, 2)
      });

      // Use retry logic + OpenAI gpt-4o-mini (same as comparison for consistency)
      const response = await retryAICall(async () => {
        return await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are an expert Danish insurance analyst. Provide honest, data-driven assessments. Always write in Danish."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 3000,
        });
      }, 'insurance-health-check');

      logAIUsage('OpenAI-gpt-4o-mini', 'insurance-health-check', true);
      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result as HealthCheckResult;
    } catch (error) {
      console.error("Insurance health check failed:", error);
      logAIUsage('OpenAI-gpt-4o-mini', 'insurance-health-check', false);
      throw new Error(`Failed to analyze insurance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const insuranceCheckService = new InsuranceCheckService();

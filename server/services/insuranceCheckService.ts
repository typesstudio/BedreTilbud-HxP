import OpenAI from "openai";
import { InsuranceData } from "./mistralOcrService";
import { Policy, offerSnapshots } from "../../shared/schema";
import { retryAICall } from "../utils/retry";
import { loadPrompt, replaceVariables } from "../ai-prompts/utils/promptLoader";

// Type for OfferSnapshot select
type OfferSnapshot = typeof offerSnapshots.$inferSelect;

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

/**
 * Deterministically generates 120 monthly chart data points for cumulative savings.
 * Ensures consistent visualization regardless of AI output quality.
 */
function generate120MonthChartData(realisticAnnualSavings: number): Array<{ month: string; savings: number }> {
  const monthlySavings = realisticAnnualSavings / 12;
  const chartData: Array<{ month: string; savings: number }> = [];
  
  for (let i = 1; i <= 120; i++) {
    chartData.push({
      month: `Måned ${i}`,
      savings: Math.round(monthlySavings * i)
    });
  }
  
  return chartData;
}

/**
 * Validates and normalizes cumulativeSavings from AI output.
 * Fills missing chartData with deterministic calculation to guarantee 120 entries.
 */
function normalizeCumulativeSavings(
  aiOutput: any,
  realisticAnnualSavings: number
): HealthCheckResult['cumulativeSavings'] {
  const conservativeSavings = aiOutput.potentialSavings?.conservative || realisticAnnualSavings * 0.6;
  const optimisticSavings = aiOutput.potentialSavings?.optimistic || realisticAnnualSavings * 1.5;
  
  // Generate full 120-month chart data
  const chartData = generate120MonthChartData(realisticAnnualSavings);
  
  // Calculate key metrics from chartData
  const after12Months = chartData[11]?.savings || Math.round(realisticAnnualSavings);
  const after10Years = chartData[119]?.savings || Math.round(realisticAnnualSavings * 10);
  
  return {
    totalOver10Years: after10Years,
    monthlyRange: {
      min: Math.round(conservativeSavings / 12),
      max: Math.round(optimisticSavings / 12)
    },
    after12Months,
    after10Years,
    chartData
  };
}

class InsuranceCheckService {
  /**
   * Analyzes insurance health using OfferSnapshot (validated, normalized data).
   * Supports both legacy Policy and new OfferSnapshot objects for backward compatibility.
   */
  async analyzeInsuranceHealth(input: Policy | OfferSnapshot): Promise<HealthCheckResult> {
    try {
      // Determine if input is OfferSnapshot or legacy Policy
      const isOfferSnapshot = 'extractionVersion' in input;
      
      const coverageDetails = input.coverageDetails as any;
      const policyType = input.policyType || 'home';
      const premium = isOfferSnapshot 
        ? (input as OfferSnapshot).premium 
        : (input as Policy).premium;
      const deductible = isOfferSnapshot
        ? (input as OfferSnapshot).deductible
        : (input as Policy).deductible;
      
      console.log(`[Health Check] Using ${isOfferSnapshot ? 'OfferSnapshot' : 'Legacy Policy'} (confidence: ${isOfferSnapshot ? (input as OfferSnapshot).confidenceScore : 'N/A'}%)`);
      
      const promptTemplate = loadPrompt('health-check/analysis');
      const prompt = replaceVariables(promptTemplate, {
        policyType,
        premium: premium || 'N/A',
        deductible: deductible || 'N/A',
        coverageDetails: JSON.stringify(coverageDetails, null, 2)
      });

      // Use retry logic + OpenAI gpt-4o for high-quality analysis
      const response = await retryAICall(async () => {
        return await openai.chat.completions.create({
          model: "gpt-4o",
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
          max_completion_tokens: 8000,
        });
      }, 'insurance-health-check');

      logAIUsage('OpenAI-gpt-4o', 'insurance-health-check', true);
      const aiOutput = JSON.parse(response.choices[0].message.content || "{}");
      
      // Extract realistic savings from AI output (fallback to conservative estimate)
      const premiumNumber = Number(premium) || 0;
      const realisticSavings = aiOutput.potentialSavings?.realistic || 
                                aiOutput.annualSavings?.amount ||
                                Math.round(premiumNumber * 0.15);
      
      // Validate and normalize cumulativeSavings to guarantee 120 chart data points
      const normalizedCumulativeSavings = normalizeCumulativeSavings(aiOutput, realisticSavings);
      
      // Merge AI output with normalized cumulativeSavings
      const result: HealthCheckResult = {
        ...aiOutput,
        cumulativeSavings: normalizedCumulativeSavings
      };
      
      // Log validation results for debugging
      console.log(`[Health Check] Generated ${result.cumulativeSavings.chartData.length} chart data points`);
      console.log(`[Health Check] Cumulative savings: ${result.cumulativeSavings.after12Months} kr (12 months), ${result.cumulativeSavings.after10Years} kr (10 years)`);
      
      return result as HealthCheckResult;
    } catch (error) {
      console.error("Insurance health check failed:", error);
      logAIUsage('OpenAI-gpt-4o', 'insurance-health-check', false);
      throw new Error(`Failed to analyze insurance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const insuranceCheckService = new InsuranceCheckService();

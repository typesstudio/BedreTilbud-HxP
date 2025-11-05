import OpenAI from "openai";
import { InsuranceData } from "./mistralOcrService";
import { retryAICall } from "../utils/retry";

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
  async analyzeInsuranceHealth(policyData: InsuranceData): Promise<HealthCheckResult> {
    try {
      const prompt = `You are a Danish insurance expert analyzing a user's current insurance policy.

POLICY DATA:
${JSON.stringify(policyData, null, 2)}

TASK: Perform a comprehensive health check analysis.

1. OVERALL ASSESSMENT (0-10 score)
   - Calculate based on: coverage completeness, pricing competitiveness, value for money
   - Industry benchmarks for Danish ${policyData.policyType || 'home'} insurance

2. POTENTIAL SAVINGS
   - Compare premium against industry average for similar coverage
   - Identify overpriced elements (e.g., high deductible with high premium)
   - Estimate realistic annual savings: Conservative, Realistic, Optimistic
   - Be realistic - if pricing is already competitive, savings may be minimal

3. WHAT'S INCLUDED (strengths)
   - 4-6 highlights of good coverage/pricing
   - Examples: "Strong liability coverage", "Competitive premium", "Good deductible"
   - Use icons: "shield", "home", "dollar-sign", "check"

4. WHAT COULD BE BETTER (weaknesses)
   - 4-6 areas needing improvement
   - Categories: Missing coverage, Overpriced, Below market standard
   - Severity: critical, important, minor
   - Use icons: "alert-circle", "trending-up", "help-circle"
   - Variant: "warning" for important, "error" for critical

5. COVERAGE GAPS ANALYSIS
   Group by categories (include all 3 categories even if some are empty):
   - "Manglende Dækning": Coverage typically expected but missing
   - "Overpris Elementer": Elements costing more than market average (15%+ difference)
   - "Anbefalede Forbedringer": Recommended upgrades based on Danish standards

6. MARKET COMPARISON TABLE
   Compare against industry averages (minimum 5 rows):
   - Årlig præmie (Annual premium)
   - Selvrisiko (Deductible)
   - Dækningssum (Coverage amount)
   - Ansvarsdækning (Liability coverage)
   - Other specific coverage items from the policy

7. ACTIONABLE RECOMMENDATIONS
   - 3-5 specific next steps
   - Prioritized by impact (1 = highest priority)
   - Include estimated impact in kr/year

Danish market context:
- Consider Alm. Brand, Tryg, GF, Topdanmark as benchmarks
- Standard Danish home insurance includes: fire, water, theft, liability
- Typical deductibles: 2,500-5,000 kr
- Average annual premium for home insurance: 3,000-6,000 kr (depends on coverage)
- Average annual premium for car insurance: 4,000-8,000 kr (depends on car value)

Return JSON in this exact format:
{
  "overallScore": 7,
  "scoreExplanation": "God grunddækning, men der er potentiale for besparelser",
  "potentialSavings": {
    "conservative": 1500,
    "realistic": 2500,
    "optimistic": 4000,
    "explanation": "Baseret på markedsgennemsnit for tilsvarende dækning"
  },
  "strengths": [
    {
      "title": "Høj ansvarsdækning",
      "description": "10M kr ansvarsdækning er over markedsgennemsnittet",
      "icon": "shield",
      "variant": "success"
    }
  ],
  "weaknesses": [
    {
      "title": "Høj præmie vs selvrisiko",
      "description": "5,000 kr præmie med 5,000 kr selvrisiko er ikke optimal",
      "icon": "dollar-sign",
      "variant": "warning",
      "severity": "important"
    }
  ],
  "coverageGaps": {
    "categories": [
      {
        "name": "Manglende Dækning",
        "icon": "alert-circle",
        "items": [
          {
            "title": "Elektronik dækning",
            "description": "Ikke inkluderet - anbefales for de fleste husstande",
            "severity": "important",
            "estimatedCost": 500
          }
        ]
      },
      {
        "name": "Overpris Elementer",
        "icon": "trending-up",
        "items": [
          {
            "title": "Grundpræmie",
            "description": "15% over markedsgennemsnit",
            "severity": "critical",
            "potentialSaving": 800
          }
        ]
      },
      {
        "name": "Anbefalede Forbedringer",
        "icon": "help-circle",
        "items": []
      }
    ]
  },
  "marketComparison": [
    {
      "category": "Årlig Præmie",
      "current": "5,000 kr",
      "marketAverage": "4,200 kr",
      "difference": "+19%",
      "status": "worse"
    },
    {
      "category": "Selvrisiko",
      "current": "5,000 kr",
      "marketAverage": "3,500 kr",
      "difference": "+43%",
      "status": "worse"
    }
  ],
  "recommendations": [
    {
      "priority": 1,
      "title": "Få konkurrerende tilbud",
      "description": "3-5 forsikringsselskaber kan give dig bedre priser for samme dækning",
      "estimatedImpact": "2,500 kr/år"
    }
  ]
}

IMPORTANT: Write ALL text in Danish. Be specific with numbers. Use realistic Danish market data. If the policy already has good pricing, reflect that in lower savings estimates.`;

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

import OpenAI from "openai";
import { InsuranceData } from "./mistralOcrService";
import { Policy } from "../../shared/schema";
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
      
      const prompt = `You are a Danish insurance expert analyzing a user's current insurance policy.

POLICY DATA:
Policy Type: ${policyType}
Annual Premium: ${policy.premium || 'N/A'} DKK
Deductible: ${policy.deductible || 'N/A'} DKK
Coverage Details: ${JSON.stringify(coverageDetails, null, 2)}

TASK: Perform a comprehensive health check analysis with 6 sections.

Danish market context:
- Consider Alm. Brand, Tryg, GF, Topdanmark as benchmarks
- Standard Danish home insurance: fire, water, theft, liability
- Typical deductibles: 2,500-5,000 kr
- Average home insurance: 3,000-6,000 kr/year
- Average car insurance: 4,000-8,000 kr/year

Return JSON in this exact format:
{
  "overallScore": 7,
  "scoreExplanation": "God grunddækning med potentiale for besparelser",
  "annualSavings": {
    "amount": 3252,
    "percentageLower": 20.5,
    "explanation": "Din årlige besparelse"
  },
  "highlights": [
    {"title": "Højere dækningssum", "description": "+500k bygning", "icon": "trending-up", "variant": "success"},
    {"title": "Lavere selvrisiko", "description": "−1.000 kr pr. skade", "icon": "trending-down", "variant": "success"},
    {"title": "Vejhjælp inkluderet", "description": "24/7 i Norden", "icon": "truck", "variant": "neutral"},
    {"title": "Smart lækagesensor", "description": "Hardware fra dag ét", "icon": "droplet", "variant": "neutral"}
  ],
  "whatsIncluded": [
    {"coverage": "Brand", "description": "Dækker brandskader", "value": "inkluderet", "status": "success"},
    {"coverage": "Kasko", "description": "Storm og indbrud", "value": "inkluderet", "status": "success"},
    {"coverage": "Hus og grundejeransvar", "description": "12.000.000 kr", "value": "inkluderet", "status": "success"},
    {"coverage": "Retshjælp", "description": "Sagsomkostninger", "value": "225.000 kr", "status": "success"},
    {"coverage": "Indbo", "description": "Privat ejendele", "value": "225.000 kr", "status": "success"},
    {"coverage": "Invaliditet", "description": "Ved ulykke", "value": "225.000 kr", "status": "success"},
    {"coverage": "Bygningsbrand", "description": "Forsikringssum", "value": "225.000 kr", "status": "success"},
    {"coverage": "Anden bygningsskade", "description": "Ekstra dækning", "value": "225.000 kr", "status": "success"}
  ],
  "keyFigures": [
    {"label": "Bygningsdækning", "icon": "home", "currentValue": "2.5M", "newValue": "3.0M", "variant": "neutral"},
    {"label": "Selvrisiko", "icon": "shield", "currentValue": "3.000", "newValue": "2.000", "variant": "success"},
    {"label": "Skadebehandling", "icon": "clock", "currentValue": "5-7d", "newValue": "24h", "variant": "neutral"}
  ],
  "missingInformation": {
    "totalIssues": 12,
    "criticalCount": 3,
    "categories": [
      {
        "name": "Pris og Økonomi",
        "icon": "dollar-sign",
        "criticalCount": 3,
        "importantCount": 3,
        "questionsCount": 5,
        "items": [
          {
            "title": "Prisændringer efter bindingsperiode",
            "description": "Ingen faktorer eller maksimal stigningsprocent angivet",
            "severity": "critical",
            "response": "Ved 2 forsikringer får du 10% rabat, ved 3+ forsikringer får du 15% rabat på alle dine forsikringer."
          },
          {
            "title": "Rabatstruktur ved flere forsikringer",
            "description": "Ingen information om tilvalg og bundtrabatter",
            "severity": "important"
          },
          {
            "title": "Kan jeg vælge selvrisiko? Hvilke pris-trin findes?",
            "severity": "question"
          }
        ]
      },
      {
        "name": "Dækning",
        "icon": "shield",
        "criticalCount": 2,
        "importantCount": 0,
        "questionsCount": 0,
        "items": [
          {
            "title": "Definition af utilsigtet vandskade",
            "description": "Uklar formulering kan føre til afvisning",
            "severity": "critical"
          },
          {
            "title": "Udbetalingsgrænser for naturskader",
            "description": "Storm og oversvømmelse undergrænser uklare",
            "severity": "critical"
          }
        ]
      }
    ]
  },
  "cumulativeSavings": {
    "totalOver10Years": 34589,
    "monthlyRange": {"min": 270, "max": 300},
    "after12Months": 3420,
    "after10Years": 34400,
    "chartData": [
      {"month": "Måned 1", "savings": 270},
      {"month": "Måned 6", "savings": 1620},
      {"month": "Måned 12", "savings": 3420},
      {"month": "År 2", "savings": 6840},
      {"month": "År 5", "savings": 17100},
      {"month": "År 10", "savings": 34400}
    ]
  },
  "potentialSavings": {
    "conservative": 1500,
    "realistic": 2500,
    "optimistic": 4000,
    "explanation": "Baseret på markedsgennemsnit"
  },
  "strengths": [
    {"title": "Høj ansvarsdækning", "description": "10M kr ansvarsdækning", "icon": "shield", "variant": "success"}
  ],
  "weaknesses": [
    {"title": "Høj præmie vs selvrisiko", "description": "5,000 kr præmie med 5,000 kr selvrisiko", "icon": "dollar-sign", "variant": "warning", "severity": "important"}
  ],
  "coverageGaps": {
    "categories": [
      {"name": "Manglende Dækning", "icon": "alert-circle", "items": [{"title": "Elektronik dækning", "description": "Ikke inkluderet", "severity": "important", "estimatedCost": 500}]},
      {"name": "Overpris Elementer", "icon": "trending-up", "items": [{"title": "Grundpræmie", "description": "15% over markedsgennemsnit", "severity": "critical", "potentialSaving": 800}]},
      {"name": "Anbefalede Forbedringer", "icon": "help-circle", "items": []}
    ]
  },
  "marketComparison": [
    {"category": "Årlig Præmie", "current": "5,000 kr", "marketAverage": "4,200 kr", "difference": "+19%", "status": "worse"},
    {"category": "Selvrisiko", "current": "5,000 kr", "marketAverage": "3,500 kr", "difference": "+43%", "status": "worse"}
  ],
  "recommendations": [
    {"priority": 1, "title": "Få konkurrerende tilbud", "description": "3-5 forsikringsselskaber", "estimatedImpact": "2,500 kr/år"}
  ]
}

IMPORTANT: Write ALL text in Danish. Be specific with numbers. Use realistic Danish market data.`;

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

import OpenAI from "openai";
import { InsuranceData } from "./mistralOcrService";
import { mistralTextService } from "./mistralTextService";
import { retryAICall } from "../utils/retry";
import { sanitizePrompt, detectInjection, validateAIOutput } from "../utils/aiSanitization";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

// Cost-effective AI usage logger
function logAIUsage(provider: string, operation: string, success: boolean) {
  const timestamp = new Date().toISOString();
  console.log(`[AI Usage] ${timestamp} | ${provider} | ${operation} | ${success ? 'SUCCESS' : 'FAILED'}`);
}

export interface MissingInfoQuestion {
  id: string;
  question: string;
  explanation: string;
  severity: "critical" | "important" | "question";
  category: string;
  categoryIcon: string;
  answer?: string;
}

export interface MissingInfoCategory {
  name: string;
  icon: string;
  iconVariant: "error" | "warning" | "neutral";
  criticalCount: number;
  importantCount: number;
  questionCount: number;
  questions: MissingInfoQuestion[];
}

export interface ComparisonResult {
  savings: number;
  savingsPercentage: number;
  verdict: "recommended" | "consider" | "not_recommended";
  aiRecommendation: string;
  pros: string[];
  cons: string[];
  highlights: {
    title: string;
    description: string;
    icon: string;
    variant: "success" | "neutral" | "warning";
  }[];
  detailedComparison: {
    category: string;
    rows: {
      feature: string;
      current: string;
      offer: string;
      difference: string;
      status: "same" | "better" | "worse";
    }[];
  }[];
  keyMetrics: {
    label: string;
    current: string;
    offer: string;
    icon: string;
    variant: "success" | "neutral";
  }[];
  addedBenefits: {
    label: string;
    variant: "success" | "neutral";
  }[];
  coverageComparison: {
    category: string;
    current: string;
    offer: string;
    status: "same" | "improved" | "reduced";
  }[];
  qualityScore: number;
  missingInfo?: {
    totalCritical: number;
    totalImportant: number;
    totalQuestions: number;
    categories: MissingInfoCategory[];
  };
  cumulativeSavings?: {
    monthly: number;
    yearly: number;
    tenYear: number;
    chartData: { year: string; savings: number }[];
  };
}

export class ComparisonService {
  async compareInsurancePolicies(
    currentPolicy: InsuranceData,
    offerPolicy: InsuranceData,
    userPreferences?: {
      housingType?: string;
      hasCar?: boolean;
      deductible?: string;
      additionalInfo?: string;
    }
  ): Promise<ComparisonResult> {
    try {
      const prompt = `You are an expert Danish insurance advisor analyzing insurance policies. Compare these two policies and identify ALL missing or unclear information that could affect the customer.

Current Policy:
${JSON.stringify(currentPolicy, null, 2)}

New Offer:
${JSON.stringify(offerPolicy, null, 2)}

User Preferences:
${JSON.stringify(userPreferences || {}, null, 2)}

As an insurance expert, scrutinize the offer for:
- Hidden costs, fee structures, price increases after binding period
- Unclear coverage definitions, loopholes, exclusions
- Missing policy details, terms, or conditions
- Ambiguous claims handling procedures
- Undisclosed limitations or restrictions

Categorize findings by severity:
- CRITICAL: Major issues that could lead to claim rejection or unexpected costs
- IMPORTANT: Significant gaps that should be clarified before purchase
- QUESTION: General clarifications that would be helpful to know

Provide comprehensive analysis in this JSON structure:
{
  "savings": number,
  "savingsPercentage": number,
  "verdict": "recommended" | "consider" | "not_recommended",
  "aiRecommendation": "detailed explanation in Danish",
  "pros": ["list", "of", "advantages"],
  "cons": ["list", "of", "disadvantages"],
  "highlights": [
    {
      "title": "Højere dækningssum",
      "description": "+500k bygning",
      "icon": "trending-up",
      "variant": "success"
    }
  ],
  "detailedComparison": [
    {
      "category": "Pris og gebyrer",
      "rows": [
        {
          "feature": "Månedlig præmie",
          "current": "1.319 kr",
          "offer": "1.049 kr",
          "difference": "-271 kr/md",
          "status": "better"
        }
      ]
    }
  ],
  "keyMetrics": [
    {
      "label": "Bygningsdækning",
      "current": "2.5M",
      "offer": "3.0M",
      "icon": "home",
      "variant": "success"
    }
  ],
  "addedBenefits": [
    {
      "label": "Lækagesensor",
      "variant": "success"
    }
  ],
  "coverageComparison": [
    {
      "category": "coverage category",
      "current": "current details", 
      "offer": "offer details",
      "status": "same" | "improved" | "reduced"
    }
  ],
  "qualityScore": number,
  "missingInfo": {
    "totalCritical": number,
    "totalImportant": number,
    "totalQuestions": number,
    "categories": [
      {
        "name": "Pris & Økonomi",
        "icon": "dollar-sign",
        "iconVariant": "error",
        "criticalCount": number,
        "importantCount": number,
        "questionCount": number,
        "questions": [
          {
            "id": "unique-id",
            "question": "Prisændringer efter bindingsperiode",
            "explanation": "Ingen faktorer eller maksimal stigningsprocent angivet",
            "severity": "critical",
            "category": "Pris & Økonomi",
            "categoryIcon": "dollar-sign"
          }
        ]
      }
    ]
  },
  "cumulativeSavings": {
    "monthly": number,
    "yearly": number,
    "tenYear": number,
    "chartData": [
      { "year": "År 1", "savings": number },
      { "year": "År 2", "savings": number }
    ]
  }
}

IMPORTANT: Categorize ALL missing information into exactly these 4 categories:
1. "Pris & Økonomi" (dollar-sign icon) - Price changes, fees, discounts, bundle pricing, deductible options
2. "Dækning" (shield icon) - Coverage definitions, limitations, exclusions, geographical restrictions
3. "Skadebehandling" (clock icon) - Claims handling, response times, payout procedures, documentation requirements
4. "Andet" (help-circle icon) - All other questions that don't fit the above categories

Every question MUST be assigned to one of these categories. Be thorough in identifying missing information - this is critical for customer protection.

Write ALL text in Danish. Be thorough in identifying missing information - this is critical for customer protection.`;

      // Use cost-effective gpt-4o-mini for comparisons (much cheaper than gpt-4-turbo)
      // Wrap in retry logic for resilience
      const response = await retryAICall(async () => {
        return await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are an expert Danish insurance advisor. Provide thorough, honest comparisons that help users make informed decisions. Always write responses in Danish. Be specific and use actual numbers from the policies."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 3000,
        });
      }, 'policy-comparison');

      logAIUsage('OpenAI-gpt-4o-mini', 'policy-comparison', true);
      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result as ComparisonResult;
    } catch (error) {
      console.error("Comparison failed:", error);
      logAIUsage('OpenAI-gpt-4o-mini', 'policy-comparison', false);
      throw new Error(`Failed to compare policies: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generatePersonalizedEmail(
    companyName: string,
    userInfo: {
      housingType?: string;
      hasCar?: boolean;
      deductible?: string;
      additionalInfo?: string;
    },
    currentPolicies: InsuranceData[]
  ): Promise<string> {
    // Sanitize user input to prevent prompt injection
    if (userInfo.additionalInfo) {
      const sanitized = sanitizePrompt(userInfo.additionalInfo);
      const injectionCheck = detectInjection(sanitized);
      if (!injectionCheck.safe) {
        throw new Error(`Unsafe user input detected: ${injectionCheck.reason}`);
      }
      userInfo.additionalInfo = sanitized;
    }
    
    // Strategy: Try Mistral first (cheapest), then OpenAI, then template fallback
    
    // Try 1: Mistral (most cost-effective)
    try {
      console.log("[Email Gen] Attempting Mistral first (most cost-effective)...");
      const email = await mistralTextService.generatePersonalizedEmail(
        companyName,
        userInfo,
        currentPolicies
      );
      logAIUsage('Mistral-large', 'personalized-email', true);
      return email;
    } catch (mistralError) {
      console.error("[Email Gen] Mistral failed, trying OpenAI fallback:", mistralError);
      logAIUsage('Mistral-large', 'personalized-email', false);
    }

    // Try 2: OpenAI gpt-4o-mini (cheaper than GPT-4)
    try {
      console.log("[Email Gen] Attempting OpenAI gpt-4o-mini fallback...");
      const prompt = `Generate a personalized insurance inquiry email in Danish to ${companyName}.

User Information:
- Boligtype: ${userInfo.housingType || 'Ikke angivet'}
- Har bil: ${userInfo.hasCar ? 'Ja' : 'Nej'}
- Ønsket selvrisiko: ${userInfo.deductible || 'Ikke angivet'}
- Yderligere oplysninger: ${userInfo.additionalInfo || 'Ingen'}

Current Policies Summary:
${currentPolicies.map(p => `- ${p.policyType}: ${p.annualPremium} kr./år (${p.companyName})`).join('\n')}

Write a professional, friendly email that:
1. Introduces the inquiry
2. Mentions specific user requirements
3. Asks for a competitive quote
4. Mentions that current policies are attached for reference
5. Is polite and professional

Return only the email body text, no subject line.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a professional insurance broker writing on behalf of clients. Write clear, polite emails in Danish that get results."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_completion_tokens: 1024,
      });

      logAIUsage('OpenAI-gpt-4o-mini', 'personalized-email', true);
      return response.choices[0].message.content || "";
    } catch (openaiError) {
      console.error("[Email Gen] OpenAI also failed, using template fallback:", openaiError);
      logAIUsage('OpenAI-gpt-4o-mini', 'personalized-email', false);
    }

    // Try 3: Template fallback (always works)
    console.log("[Email Gen] Using template fallback (no AI cost)");
    logAIUsage('Template', 'personalized-email', true);
    return this.generateTemplateEmail(companyName, userInfo, currentPolicies);
  }

  private generateTemplateEmail(
    companyName: string,
    userInfo: {
      housingType?: string;
      hasCar?: boolean;
      deductible?: string;
      additionalInfo?: string;
    },
    currentPolicies: InsuranceData[]
  ): string {
    const policySummary = currentPolicies.map(p => 
      `- ${p.policyType}: ${p.annualPremium} kr./år (${p.companyName})`
    ).join('\n');

    return `Hej ${companyName},

Jeg søger et konkurrencedygtigt forsikringstilbud og vil gerne høre, hvad I kan tilbyde.

Mine oplysninger:
- Boligtype: ${userInfo.housingType || 'Ikke angivet'}
- Har bil: ${userInfo.hasCar ? 'Ja' : 'Nej'}
- Ønsket selvrisiko: ${userInfo.deductible || 'Ikke angivet'}
${userInfo.additionalInfo ? `- Yderligere oplysninger: ${userInfo.additionalInfo}` : ''}

Mine nuværende forsikringer:
${policySummary}

Jeg har vedhæftet mine nuværende policer som reference. Vil I venligst komme med et tilbud, der matcher eller forbedrer min nuværende dækning?

Jeg ser frem til at høre fra jer.

Med venlig hilsen`;
  }

  async generateAutoResponse(
    incomingEmailBody: string,
    context: {
      companyName: string;
      userInfo: any;
      sentEmail: string;
    }
  ): Promise<string> {
    // Strategy: Try Mistral first (cheapest), then OpenAI, then template fallback
    
    // Try 1: Mistral (most cost-effective)
    try {
      console.log("[Auto Response] Attempting Mistral first (most cost-effective)...");
      const response = await mistralTextService.generateAutoResponse(
        incomingEmailBody,
        context
      );
      logAIUsage('Mistral-large', 'auto-response', true);
      return response;
    } catch (mistralError) {
      console.error("[Auto Response] Mistral failed, trying OpenAI fallback:", mistralError);
      logAIUsage('Mistral-large', 'auto-response', false);
    }

    // Try 2: OpenAI gpt-4o-mini (cheaper than GPT-4)
    try {
      console.log("[Auto Response] Attempting OpenAI gpt-4o-mini fallback...");
      const prompt = `Generate an appropriate auto-response to this incoming email in Danish.

Incoming Email:
${incomingEmailBody}

Context:
- Company: ${context.companyName}
- Original inquiry: ${context.sentEmail}

Generate a professional response that:
1. Thanks them for their offer
2. Shows interest
3. Asks relevant follow-up questions
4. Maintains professional tone
5. Is written in Danish

Keep it concise and appropriate for email communication.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are writing auto-responses for insurance inquiries. Be professional, polite, and ask intelligent follow-up questions."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_completion_tokens: 1024,
      });

      logAIUsage('OpenAI-gpt-4o-mini', 'auto-response', true);
      return response.choices[0].message.content || "";
    } catch (openaiError) {
      console.error("[Auto Response] OpenAI also failed, using template fallback:", openaiError);
      logAIUsage('OpenAI-gpt-4o-mini', 'auto-response', false);
    }

    // Try 3: Template fallback (always works)
    console.log("[Auto Response] Using template fallback (no AI cost)");
    logAIUsage('Template', 'auto-response', true);
    return `Tak for din henvendelse, ${context.companyName}.

Jeg vil gerne høre mere om jeres tilbud og vil vende tilbage med eventuelle spørgsmål.

Med venlig hilsen`;
  }

  async generateMissingInfoEmail(
    companyName: string,
    selectedQuestions: MissingInfoQuestion[]
  ): Promise<string> {
    // Strategy: Try Mistral first (cheapest), then OpenAI, then template fallback
    
    const questionTexts = selectedQuestions.map(q => q.question);
    
    // Try 1: Mistral (most cost-effective)
    try {
      console.log("[Missing Info] Attempting Mistral first (most cost-effective)...");
      const email = await mistralTextService.generateMissingInfoEmail(
        companyName,
        questionTexts
      );
      logAIUsage('Mistral-large', 'missing-info-email', true);
      return email;
    } catch (mistralError) {
      console.error("[Missing Info] Mistral failed, trying OpenAI fallback:", mistralError);
      logAIUsage('Mistral-large', 'missing-info-email', false);
    }

    // Try 2: OpenAI gpt-4o-mini (cheaper than GPT-4)
    try {
      console.log("[Missing Info] Attempting OpenAI gpt-4o-mini fallback...");
      const prompt = `Generate a professional email in Danish to ${companyName} asking for clarification on these insurance policy points:

${selectedQuestions.map((q, i) => `${i + 1}. ${q.question}${q.explanation ? ` - ${q.explanation}` : ''}`).join('\n')}

Create a polite, professional email that:
1. References the insurance offer they provided
2. Expresses interest in the policy
3. Lists the questions clearly and concisely
4. Asks for written clarification
5. Maintains a professional, respectful tone
6. Is written in Danish

Return only the email body text, no subject line.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a professional insurance advisor writing on behalf of clients. Write clear, polite emails in Danish that help customers understand their insurance policies better."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_completion_tokens: 1500,
      });

      logAIUsage('OpenAI-gpt-4o-mini', 'missing-info-email', true);
      return response.choices[0].message.content || "";
    } catch (openaiError) {
      console.error("[Missing Info] OpenAI also failed, using template fallback:", openaiError);
      logAIUsage('OpenAI-gpt-4o-mini', 'missing-info-email', false);
    }

    // Try 3: Template fallback (always works)
    console.log("[Missing Info] Using template fallback (no AI cost)");
    logAIUsage('Template', 'missing-info-email', true);
    return `Hej ${companyName},

Tak for jeres tilbud. Jeg er interesseret, men har brug for afklaring på følgende punkter:

${selectedQuestions.map((q, i) => `${i + 1}. ${q.question}${q.explanation ? `\n   ${q.explanation}` : ''}`).join('\n\n')}

Jeg vil sætte stor pris på skriftlig afklaring af disse punkter, så jeg kan træffe en informeret beslutning.

Med venlig hilsen`;
  }

  async extractAnswersFromReply(
    emailBody: string,
    questions: MissingInfoQuestion[]
  ): Promise<{ questionId: string; answer: string }[]> {
    try {
      // Sanitize email body to prevent injection
      const sanitizedEmailBody = sanitizePrompt(emailBody);
      
      // Detect potential injection attempts
      const injectionCheck = detectInjection(sanitizedEmailBody);
      if (!injectionCheck.safe) {
        throw new Error(`Unsafe email content detected: ${injectionCheck.reason}`);
      }
      
      const prompt = `Extract and match answers from this insurance company reply to the original questions.

Company Reply:
${sanitizedEmailBody}

Original Questions:
${questions.map(q => `ID: ${q.id} - ${q.question}`).join('\n')}

Analyze the reply and extract answers for each question. Match answers to questions using semantic understanding, even if the reply doesn't follow the same order.

Return JSON array:
[
  {
    "questionId": "question-id",
    "answer": "extracted answer text in Danish"
  }
]

If a question isn't answered, omit it from the array. Be thorough in extracting relevant information.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert at analyzing insurance company responses and matching them to customer questions. Extract accurate, relevant answers."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2000,
      });

      logAIUsage('OpenAI-gpt-4o-mini', 'answer-extraction', true);
      
      // Validate AI output
      const rawOutput = response.choices[0].message.content || "{}";
      const outputValidation = validateAIOutput(rawOutput, 'json');
      if (!outputValidation.valid) {
        throw new Error(`Invalid AI output: ${outputValidation.reason}`);
      }
      
      const result = JSON.parse(rawOutput);
      return result.answers || [];
    } catch (error) {
      console.error("Answer extraction failed:", error);
      logAIUsage('OpenAI-gpt-4o-mini', 'answer-extraction', false);
      throw new Error(`Failed to extract answers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const comparisonService = new ComparisonService();

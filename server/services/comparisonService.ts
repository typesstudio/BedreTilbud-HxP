import OpenAI from "openai";
import { InsuranceData } from "./mistralOcrService";
import { mistralTextService } from "./mistralTextService";
import { retryAICall } from "../utils/retry";
import { sanitizePrompt, detectInjection, validateAIOutput } from "../utils/aiSanitization";
import { loadPrompt, replaceVariables } from "../ai-prompts/utils/promptLoader";
import { offerSnapshots } from "../../shared/schema";

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
    variant: "success" | "warning" | "error" | "info";
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
  private validateComparisonCompleteness(result: any): void {
    const issues: string[] = [];

    if (!result.detailedComparison || !Array.isArray(result.detailedComparison)) {
      issues.push("Missing detailedComparison array");
    } else {
      if (result.detailedComparison.length < 3) {
        issues.push(`detailedComparison has only ${result.detailedComparison.length} categories (required: 3+)`);
      }

      const hasPrice = result.detailedComparison.some((cat: any) => 
        cat.category?.toLowerCase().includes('pris') || 
        cat.category?.toLowerCase().includes('gebyr')
      );
      const hasCoverage = result.detailedComparison.some((cat: any) => 
        cat.category?.toLowerCase().includes('dækning')
      );

      if (!hasPrice) {
        issues.push("Missing 'Pris og gebyrer' category in detailedComparison");
      }
      if (!hasCoverage) {
        issues.push("Missing 'Dækning' category in detailedComparison");
      }

      result.detailedComparison.forEach((cat: any, idx: number) => {
        if (!cat.rows || cat.rows.length === 0) {
          issues.push(`Category '${cat.category || idx}' has no rows`);
        }
      });
    }

    if (!result.highlights || result.highlights.length < 3) {
      issues.push(`highlights has only ${result.highlights?.length || 0} items (expected: 4-6)`);
    }

    if (!result.pros || result.pros.length === 0) {
      issues.push("Missing pros array");
    }

    if (!result.cons || result.cons.length === 0) {
      issues.push("Missing cons array");
    }

    if (!result.projection || !Array.isArray(result.projection)) {
      const error = "CRITICAL: Missing projection array - comparison cannot be displayed";
      console.error(`[Comparison Validation] ${error}`);
      throw new Error(error);
    } else if (result.projection.length !== 120) {
      const error = `CRITICAL: projection has ${result.projection.length} entries (required: exactly 120 for 10-year view)`;
      console.error(`[Comparison Validation] ${error}`);
      throw new Error(error);
    }

    if (issues.length > 0) {
      console.warn(`[Comparison Validation] ⚠️ Completeness issues detected:\n  - ${issues.join('\n  - ')}`);
      console.warn(`[Comparison Validation] Result may be incomplete, but returning as-is`);
    } else {
      console.log(`[Comparison Validation] ✅ Comparison result is complete`);
    }
  }

  /**
   * Compares insurance policies using OfferSnapshots (validated, normalized data).
   * Supports both legacy InsuranceData and new OfferSnapshot objects for backward compatibility.
   */
  async compareInsurancePolicies(
    currentPolicy: InsuranceData | OfferSnapshot,
    offerPolicy: InsuranceData | OfferSnapshot,
    userPreferences?: {
      housingType?: string;
      hasCar?: boolean;
      deductible?: string;
      additionalInfo?: string;
    }
  ): Promise<ComparisonResult> {
    try {
      // Determine if inputs are OfferSnapshots or legacy InsuranceData
      const isCurrentSnapshot = 'extractionVersion' in currentPolicy;
      const isOfferSnapshot = 'extractionVersion' in offerPolicy;
      
      console.log(`[Comparison] Current: ${isCurrentSnapshot ? 'OfferSnapshot' : 'InsuranceData'}, Offer: ${isOfferSnapshot ? 'OfferSnapshot' : 'InsuranceData'}`);
      if (isCurrentSnapshot && isOfferSnapshot) {
        const currentConf = (currentPolicy as OfferSnapshot).confidenceScore;
        const offerConf = (offerPolicy as OfferSnapshot).confidenceScore;
        console.log(`[Comparison] Confidence scores: Current ${currentConf}%, Offer ${offerConf}%`);
      }
      
      const promptTemplate = loadPrompt('comparison/policy-comparison');
      const prompt = replaceVariables(promptTemplate, {
        currentPolicy: JSON.stringify(currentPolicy, null, 2),
        offerPolicy: JSON.stringify(offerPolicy, null, 2),
        userPreferences: JSON.stringify(userPreferences || {}, null, 2)
      });

      // Use high-quality gpt-4o for comparisons (better analysis than gpt-4o-mini)
      // Wrap in retry logic for resilience
      const response = await retryAICall(async () => {
        return await openai.chat.completions.create({
          model: "gpt-4o",
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

      logAIUsage('OpenAI-gpt-4o', 'policy-comparison', true);
      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      this.validateComparisonCompleteness(result);
      
      return result as ComparisonResult;
    } catch (error) {
      console.error("Comparison failed:", error);
      logAIUsage('OpenAI-gpt-4o', 'policy-comparison', false);
      throw new Error(`Failed to compare policies: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generatePersonalizedEmail(
    companyName: string,
    userInfo: {
      userName?: string;
      cprNumber?: string;
      requestedInsurances?: string;
    }
  ): Promise<string> {
    // Strategy: Try Mistral first (cheapest), then OpenAI, then template fallback
    
    // Try 1: Mistral (most cost-effective)
    try {
      console.log("[Email Gen] Attempting Mistral first (most cost-effective)...");
      const email = await mistralTextService.generatePersonalizedEmail(
        companyName,
        userInfo
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
      
      // Build CPR instruction based on whether CPR is available
      const hasCpr = userInfo.cprNumber && userInfo.cprNumber !== 'Ikke angivet';
      const cprInstruction = hasCpr 
        ? `Kundens CPR-nummer er: ${userInfo.cprNumber} - inkluder denne linje i mailen.`
        : 'Kundens CPR-nummer er IKKE tilgængeligt - UDELAD CPR fra mailen.';

      const prompt = `Generér en kort forsikringshenvendelse til ${companyName}.

Kundens navn: ${userInfo.userName || 'Ikke angivet'}
${cprInstruction}

Forsikringstyper der ønskes tilbud på:
${userInfo.requestedInsurances || '- Forsikring (baseret på vedhæftede policer)'}

Skriv en kort mail (maks. 10-12 linjer) baseret på denne skabelon:

Hej hos [selskab],

Vi skriver på vegne af [kundens navn], som gerne vil modtage forsikringstilbud på følgende forsikringer:

[liste over forsikringstyper]

[CPR-linje KUN hvis CPR er tilgængeligt]

For jeres reference har vi vedhæftet kopi af de nuværende policer, så I kan se eksisterende dækning.

Vi beder jer venligst om at sende et konkret, fuldt tilbud som PDF direkte vedhæftet svaret på denne mail – ikke kun et link eller MitID-login.

Tak for hjælpen – vi ser frem til jeres tilbagemelding.

Venlig hilsen
BedreTilbud

VIGTIGE REGLER:
- Du må ALDRIG inkludere kundens e-mailadresse eller telefonnummer.
- Du må IKKE nævne sammenligning med andre tilbud.
- Returnér kun selve e-mailens brødtekst, ingen emnelinje.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Du er en professionel forsikringsmægler hos BedreTilbud. Skriv korte, klare og høflige mails på dansk."
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
    return this.generateTemplateEmail(companyName, userInfo);
  }

  private generateTemplateEmail(
    companyName: string,
    userInfo: {
      userName?: string;
      cprNumber?: string;
      requestedInsurances?: string;
    }
  ): string {
    // Build CPR line only if CPR is provided
    const cprLine = userInfo.cprNumber 
      ? `\nKundens CPR-nummer er: ${userInfo.cprNumber}\n`
      : '';

    return `Hej hos ${companyName},

Vi skriver på vegne af ${userInfo.userName || 'vores kunde'}, som gerne vil modtage forsikringstilbud på følgende forsikringer:

${userInfo.requestedInsurances || '- Forsikring (baseret på vedhæftede policer)'}
${cprLine}
For jeres reference har vi vedhæftet kopi af de nuværende policer, så I kan se eksisterende dækning.

Vi beder jer venligst om at sende et konkret, fuldt tilbud som PDF direkte vedhæftet svaret på denne mail – ikke kun et link eller MitID-login. På den måde kan vi nemt gemme og gennemgå tilbuddet for kunden.

Tak for hjælpen – vi ser frem til jeres tilbagemelding.

Venlig hilsen
BedreTilbud`;
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

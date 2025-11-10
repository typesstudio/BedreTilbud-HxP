import OpenAI from "openai";
import type { IStorage } from "../storage";

interface ExtractedPolicyData {
  policyType: string;
  companyName: string;
  premium: number | null;
  deductible: number | null;
  coverageDetails: {
    mainCoverages: Array<{
      name: string;
      limit: string | null;
      deductible: string | null;
    }>;
    additionalCoverages: Array<{
      name: string;
      included: boolean;
    }>;
  };
  sourcePageRange: string | null;
  confidence: number;
}

interface ExtractionResult {
  success: boolean;
  policies: ExtractedPolicyData[];
  totalPoliciesFound: number;
  processingTimeMs: number;
  model: string;
  error?: string;
}

export class OpenAIExtractionService {
  private openai: OpenAI;
  private storage: IStorage;
  private model = "gpt-4o-mini";

  constructor(storage: IStorage) {
    this.storage = storage;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async extractPoliciesFromMarkdown(
    markdown: string,
    documentId: string
  ): Promise<ExtractionResult> {
    const startTime = Date.now();

    try {
      console.log(`[OpenAI Extraction] Starting extraction for document ${documentId}`);
      console.log(`[OpenAI Extraction] Markdown length: ${markdown.length} chars`);

      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(markdown);

      console.log(`[OpenAI Extraction] Calling OpenAI ${this.model}...`);

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1, // Low temperature for consistent extraction
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error("No response from OpenAI");
      }

      console.log(`[OpenAI Extraction] Received response, parsing JSON...`);
      const parsedResponse = JSON.parse(responseText);

      // Validate and normalize the response
      const policies = this.normalizeExtractedPolicies(parsedResponse.policies || []);

      const processingTimeMs = Date.now() - startTime;

      console.log(`[OpenAI Extraction] Successfully extracted ${policies.length} policies in ${processingTimeMs}ms`);

      return {
        success: true,
        policies,
        totalPoliciesFound: policies.length,
        processingTimeMs,
        model: this.model,
      };

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      console.error(`[OpenAI Extraction] Failed after ${processingTimeMs}ms:`, error);

      return {
        success: false,
        policies: [],
        totalPoliciesFound: 0,
        processingTimeMs,
        model: this.model,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private buildSystemPrompt(): string {
    return `You are an expert Danish insurance policy document analyzer. Your task is to extract ALL insurance policies from OCR-processed PDF text.

CRITICAL RULES:
1. Extract EVERY policy found in the document (often multiple policies per PDF)
2. Danish number format: "5.682,13 kr" = 5682.13 (period=thousands, comma=decimal)
3. Return ONLY valid JSON with no additional text
4. If a field is not found, use null (not empty string or 0)
5. Confidence score: 0.9+ = complete data, 0.7-0.9 = good, <0.7 = incomplete

POLICY TYPES (Danish):
- "hus" (home insurance / fritidshusforsikring)
- "ulykke" (accident insurance / ulykkesforsikring)
- "bil" (car insurance)
- "indbo" (contents insurance)
- "rejse" (travel insurance)
- "liv" (life insurance)
- "sundhed" (health insurance)

JSON SCHEMA:
{
  "policies": [
    {
      "policyType": "hus" | "ulykke" | "bil" | "indbo" | "rejse" | "liv" | "sundhed",
      "companyName": "string",
      "premium": number (annual premium in DKK, e.g., 5682.13),
      "deductible": number (selvrisiko in DKK, e.g., 2834.50),
      "coverageDetails": {
        "mainCoverages": [
          {
            "name": "string (e.g., 'Bygning', 'Personskade')",
            "limit": "string (e.g., '5 mio. kr', 'Inkluderet')",
            "deductible": "string (e.g., '2.834 kr', 'Ingen')"
          }
        ],
        "additionalCoverages": [
          {
            "name": "string",
            "included": boolean
          }
        ]
      },
      "sourcePageRange": "string (e.g., '1-3', '1', null if unknown)",
      "confidence": number (0.0-1.0)
    }
  ]
}

EXTRACTION STRATEGY:
1. Scan for policy sections (often marked by headers or tables)
2. For each policy found:
   - Identify type from keywords (e.g., "fritidshusforsikring" → "hus")
   - Find annual premium (look for "årlig pris", "pris pr. år", "total pris")
   - Find deductible (look for "selvrisiko", "egen risiko")
   - Extract all coverage items from tables
3. Assign confidence based on data completeness`;
  }

  private buildUserPrompt(markdown: string): string {
    return `Extract all insurance policies from this Danish insurance offer document. Return valid JSON only.

OCR TEXT:
${markdown}

Remember:
- Extract EVERY policy in the document
- Danish numbers: "5.682,13 kr" → 5682.13
- Return only JSON, no additional text`;
  }

  private normalizeExtractedPolicies(rawPolicies: any[]): ExtractedPolicyData[] {
    return rawPolicies.map((policy) => {
      return {
        policyType: this.normalizePolicyType(policy.policyType),
        companyName: String(policy.companyName || "Unknown"),
        premium: this.normalizeNumber(policy.premium),
        deductible: this.normalizeNumber(policy.deductible),
        coverageDetails: {
          mainCoverages: Array.isArray(policy.coverageDetails?.mainCoverages)
            ? policy.coverageDetails.mainCoverages.map((c: any) => ({
                name: String(c.name || ""),
                limit: c.limit ? String(c.limit) : null,
                deductible: c.deductible ? String(c.deductible) : null,
              }))
            : [],
          additionalCoverages: Array.isArray(policy.coverageDetails?.additionalCoverages)
            ? policy.coverageDetails.additionalCoverages.map((c: any) => ({
                name: String(c.name || ""),
                included: Boolean(c.included),
              }))
            : [],
        },
        sourcePageRange: policy.sourcePageRange ? String(policy.sourcePageRange) : null,
        confidence: this.normalizeConfidence(policy.confidence),
      };
    });
  }

  private normalizePolicyType(type: any): string {
    const typeStr = String(type || "").toLowerCase();
    
    // Map various variations to canonical types
    const typeMap: Record<string, string> = {
      fritidshusforsikring: "hus",
      husforsikring: "hus",
      boligforsikring: "hus",
      hus: "hus",
      
      ulykkesforsikring: "ulykke",
      ulykke: "ulykke",
      
      bilforsikring: "bil",
      motorforsikring: "bil",
      bil: "bil",
      
      indboforsikring: "indbo",
      indbo: "indbo",
      
      rejseforsikring: "rejse",
      rejse: "rejse",
      
      livsforsikring: "liv",
      liv: "liv",
      
      sundhedsforsikring: "sundhed",
      sundhed: "sundhed",
    };

    return typeMap[typeStr] || typeStr || "unknown";
  }

  private normalizeNumber(value: any): number | null {
    if (value === null || value === undefined) return null;
    
    const num = typeof value === "number" ? value : parseFloat(String(value));
    
    if (isNaN(num) || num < 0) return null;
    
    return Math.round(num * 100) / 100; // Round to 2 decimals
  }

  private normalizeConfidence(value: any): number {
    const conf = typeof value === "number" ? value : parseFloat(String(value || 0));
    
    if (isNaN(conf)) return 0.5;
    
    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, conf));
  }
}

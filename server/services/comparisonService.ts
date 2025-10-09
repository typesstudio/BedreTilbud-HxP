import OpenAI from "openai";
import { InsuranceData } from "./ocrService";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export interface ComparisonResult {
  savings: number;
  verdict: "recommended" | "consider" | "not_recommended";
  aiRecommendation: string;
  pros: string[];
  cons: string[];
  coverageComparison: {
    category: string;
    current: string;
    offer: string;
    status: "same" | "improved" | "reduced";
  }[];
  qualityScore: number;
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
      const prompt = `Compare these two insurance policies and provide a detailed analysis in JSON format.

Current Policy:
${JSON.stringify(currentPolicy, null, 2)}

New Offer:
${JSON.stringify(offerPolicy, null, 2)}

User Preferences:
${JSON.stringify(userPreferences || {}, null, 2)}

Provide analysis in this JSON structure:
{
  "savings": number, // annual savings in DKK (negative if more expensive)
  "verdict": "recommended" | "consider" | "not_recommended",
  "aiRecommendation": "detailed explanation in Danish of why this is/isn't a good deal",
  "pros": ["list", "of", "advantages"],
  "cons": ["list", "of", "disadvantages"],
  "coverageComparison": [
    {
      "category": "coverage category name",
      "current": "current coverage details", 
      "offer": "new offer coverage details",
      "status": "same" | "improved" | "reduced"
    }
  ],
  "qualityScore": number // 1-10 score for overall value
}

Focus on Danish market context and write all text in Danish. Consider user preferences in your analysis.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert Danish insurance advisor. Provide thorough, honest comparisons that help users make informed decisions. Always write responses in Danish."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2048,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result as ComparisonResult;
    } catch (error) {
      console.error("Comparison failed:", error);
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
    try {
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
        model: "gpt-4",
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

      return response.choices[0].message.content || "";
    } catch (error) {
      console.error("Email generation failed:", error);
      throw new Error(`Failed to generate email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateAutoResponse(
    incomingEmailBody: string,
    context: {
      companyName: string;
      userInfo: any;
      sentEmail: string;
    }
  ): Promise<string> {
    try {
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
        model: "gpt-4",
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

      return response.choices[0].message.content || "";
    } catch (error) {
      console.error("Auto-response generation failed:", error);
      throw new Error(`Failed to generate auto-response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const comparisonService = new ComparisonService();

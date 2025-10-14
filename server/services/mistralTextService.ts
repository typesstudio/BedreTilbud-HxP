import { Mistral } from '@mistralai/mistralai';

const mistral = new Mistral({ 
  apiKey: process.env.MISTRAL_API_KEY || ""
});

export class MistralTextService {
  async generateText(
    systemPrompt: string,
    userPrompt: string,
    options: {
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<string> {
    try {
      console.log(`[Mistral Text] Generating text with model: mistral-large-latest`);
      
      const response = await mistral.chat.complete({
        model: "mistral-large-latest",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        maxTokens: options.maxTokens || 1024,
        temperature: options.temperature || 0.7
      });

      const content = response.choices?.[0]?.message?.content;
      const textContent = typeof content === 'string' ? content : '';
      console.log(`[Mistral Text] Successfully generated ${textContent.length} characters`);
      return textContent;
    } catch (error) {
      console.error("[Mistral Text] Generation failed:", error);
      throw new Error(`Mistral text generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    currentPolicies: { policyType: string; annualPremium: number; companyName: string; }[]
  ): Promise<string> {
    const systemPrompt = "You are a professional insurance broker writing on behalf of clients. Write clear, polite emails in Danish that get results.";
    
    const userPrompt = `Generate a personalized insurance inquiry email in Danish to ${companyName}.

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

    return this.generateText(systemPrompt, userPrompt, { maxTokens: 1024 });
  }

  async generateAutoResponse(
    incomingEmailBody: string,
    context: {
      companyName: string;
      userInfo: any;
      sentEmail: string;
    }
  ): Promise<string> {
    const systemPrompt = "You are writing auto-responses for insurance inquiries. Be professional, polite, and ask intelligent follow-up questions.";
    
    const userPrompt = `Generate an appropriate auto-response to this incoming email in Danish.

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

    return this.generateText(systemPrompt, userPrompt, { maxTokens: 1024 });
  }

  async generateMissingInfoEmail(
    companyName: string,
    questions: string[]
  ): Promise<string> {
    const systemPrompt = "You are a professional insurance broker writing follow-up emails in Danish. Be polite, clear, and professional.";
    
    const userPrompt = `Generate a follow-up email in Danish to ${companyName} asking about missing information.

Questions to ask:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Write a professional email that:
1. Thanks them for their previous response
2. Politely asks for the additional information
3. Lists the questions clearly
4. Maintains a friendly, professional tone
5. Is written in Danish

Return only the email body text.`;

    return this.generateText(systemPrompt, userPrompt, { maxTokens: 800 });
  }
}

export const mistralTextService = new MistralTextService();

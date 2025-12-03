import { Mistral } from '@mistralai/mistralai';
import { loadPrompt, replaceVariables } from '../ai-prompts/utils/promptLoader';

if (!process.env.MISTRAL_API_KEY) {
  throw new Error("MISTRAL_API_KEY environment variable is required");
}

const mistral = new Mistral({ 
  apiKey: process.env.MISTRAL_API_KEY
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
      userName?: string;
      cprNumber?: string;
      email?: string;
      phone?: string;
      address?: string;
      housingType?: string;
      hasCar?: boolean;
      deductible?: string;
      insuranceTypes?: string[];
      importantPoints?: string;
      additionalInfo?: string;
    },
    currentPolicies: { policyType: string; annualPremium: number; companyName: string; }[]
  ): Promise<string> {
    const systemPrompt = loadPrompt('emails/system-prompt');
    const promptTemplate = loadPrompt('emails/personalized-inquiry');
    const currentPoliciesSummary = currentPolicies.length > 0 
      ? currentPolicies.map(p => 
          `- ${p.policyType}: ${p.annualPremium} kr./år (${p.companyName})`
        ).join('\n')
      : 'Ingen nuværende policer vedhæftet';
    
    const insuranceTypesList = userInfo.insuranceTypes?.length 
      ? userInfo.insuranceTypes.join(', ')
      : 'Ikke angivet';
    
    const prompt = replaceVariables(promptTemplate, {
      companyName,
      userName: userInfo.userName || 'Ikke angivet',
      cprNumber: userInfo.cprNumber || 'Ikke angivet',
      address: userInfo.address || 'Ikke angivet',
      housingType: userInfo.housingType || 'Ikke angivet',
      hasCar: userInfo.hasCar ? 'Ja' : 'Nej',
      deductible: userInfo.deductible || 'Ikke angivet',
      insuranceTypes: insuranceTypesList,
      importantPoints: userInfo.importantPoints || userInfo.additionalInfo || 'Ingen',
      currentPolicies: currentPoliciesSummary
    });

    return this.generateText(systemPrompt, prompt, { maxTokens: 1024 });
  }

  async generateAutoResponse(
    incomingEmailBody: string,
    context: {
      companyName: string;
      userInfo: any;
      sentEmail: string;
    }
  ): Promise<string> {
    const systemPrompt = loadPrompt('emails/system-prompt');
    const promptTemplate = loadPrompt('emails/auto-response');
    const prompt = replaceVariables(promptTemplate, {
      incomingEmailBody,
      companyName: context.companyName,
      sentEmail: context.sentEmail
    });

    return this.generateText(systemPrompt, prompt, { maxTokens: 1024 });
  }

  async generateMissingInfoEmail(
    companyName: string,
    questions: string[]
  ): Promise<string> {
    const systemPrompt = loadPrompt('emails/system-prompt');
    const promptTemplate = loadPrompt('emails/missing-info');
    const questionsList = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
    
    const prompt = replaceVariables(promptTemplate, {
      companyName,
      questions: questionsList
    });

    return this.generateText(systemPrompt, prompt, { maxTokens: 800 });
  }
}

export const mistralTextService = new MistralTextService();

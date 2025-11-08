import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { storage } from "../storage";
import { loadPrompt, replaceVariables } from "../ai-prompts/utils/promptLoader";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000, // 60 second timeout for AI operations
  maxRetries: 2, // Retry failed requests up to 2 times
});

export interface AIResponseContext {
  userId: string;
  companyName: string;
  threadId: string;
  incomingMessage: string;
  conversationHistory: {
    direction: string;
    body: string;
    sentAt: Date;
  }[];
}

export class AIResponseService {

  async generateResponse(context: AIResponseContext): Promise<string> {
    try {
      console.log(`[AI Response] Generating response for thread ${context.threadId}`);
      
      // Get user data
      const user = await storage.getUser(context.userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Get user's current policy data (from their uploaded documents)
      const documents = await storage.getDocumentsByUser(context.userId);
      const currentPolicy = documents.find(d => d.type === 'current');

      // Build user context for the AI
      const userContext = {
        name: user.name || user.email,
        email: user.email,
        phone: user.phone,
        age: user.age,
        housingType: user.housingType,
        hasCarInsurance: user.hasCarInsurance,
        deductiblePreference: user.deductiblePreference,
        additionalRequirements: user.additionalRequirements,
        currentPolicyData: currentPolicy?.ocrData || null
      };

      // Format conversation history
      const conversationText = context.conversationHistory
        .map(msg => {
          const sender = msg.direction === 'inbound' ? context.companyName : 'BedreTilbud AI';
          const timestamp = new Date(msg.sentAt).toLocaleString('da-DK');
          return `[${timestamp}] ${sender}:\n${msg.body}`;
        })
        .join('\n\n---\n\n');

      // Build the user message
      const userMessage = `
**Company Name:** ${context.companyName}

**User Context:**
${JSON.stringify(userContext, null, 2)}

**Conversation History:**
${conversationText}

**New Message from ${context.companyName}:**
${context.incomingMessage}

---

Generate a response following the guidelines in the system prompt. Remember:
- Write in Danish (or English if the company wrote in English)
- Be concise (max 150 words normally)
- Only use information from the user context
- Escalate if needed (pricing, sensitive data, legal questions)
- Return ONLY the email body text, no headers or formatting
`;

      console.log(`[AI Response] Calling OpenAI with context...`);
      
      const systemPrompt = loadPrompt('emails/system-prompt');
      
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const generatedResponse = response.choices[0]?.message?.content?.trim();
      
      if (!generatedResponse) {
        throw new Error("OpenAI returned empty response");
      }

      console.log(`[AI Response] Successfully generated response (${generatedResponse.length} chars)`);
      console.log(`[AI Response] Preview: ${generatedResponse.substring(0, 150)}...`);
      
      return generatedResponse;
    } catch (error) {
      console.error("[AI Response] Generation failed:", error);
      throw new Error(`Failed to generate AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  shouldAutoRespond(messageBody: string, hasAttachments: boolean): boolean {
    // Don't auto-respond to messages with attachments (likely offers/documents)
    if (hasAttachments) {
      console.log("[AI Response] Skipping auto-response: message has attachments");
      return false;
    }

    // Check for spam/automated messages
    const spamIndicators = [
      /unsubscribe/i,
      /this is an automated message/i,
      /do not reply/i,
      /noreply@/i
    ];

    for (const pattern of spamIndicators) {
      if (pattern.test(messageBody)) {
        console.log("[AI Response] Skipping auto-response: spam indicator detected");
        return false;
      }
    }

    // Check message length (too short might be automated confirmation)
    if (messageBody.trim().length < 20) {
      console.log("[AI Response] Skipping auto-response: message too short");
      return false;
    }

    return true;
  }
}

export const aiResponseService = new AIResponseService();

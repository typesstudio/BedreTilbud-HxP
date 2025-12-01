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
  responseMode?: AutoRespondMode;
}

export type AutoRespondMode = 'none' | 'normal' | 'mitid' | 'request_pdf';

function isMitIdOnlyEmail(body: string): boolean {
  const lower = body.toLowerCase();

  const patterns = [
    'mitid',
    'mit id',
    'log ind med mitid',
    'log på med mitid',
    'gå ind på mitid',
    'selvbetjening',
    'selvbetjeningen',
    'min side',
    'minside',
    'kundeportal',
    'kundeportalen',
    'log ind på',
    'log på vores',
    'via din profil',
    'din kundeprofil',
    'online selvbetjening',
    'digital selvbetjening',
  ];

  return patterns.some((p) => lower.includes(p));
}

export function classifyIncomingEmailForAutoResponse(email: {
  body: string;
  attachments?: { mimeType?: string; contentType?: string; fileName?: string }[];
}): AutoRespondMode {
  const body = email.body ?? '';
  const attachments = email.attachments ?? [];

  const hasPdfAttachment = attachments.some((a) => {
    const type = (a.mimeType || a.contentType || '').toLowerCase();
    const fileName = (a.fileName || '').toLowerCase();
    return type.includes('pdf') || fileName.endsWith('.pdf');
  });

  const hasNonPdfAttachment = attachments.some((a) => {
    const type = (a.mimeType || a.contentType || '').toLowerCase();
    const fileName = (a.fileName || '').toLowerCase();
    const isPdf = type.includes('pdf') || fileName.endsWith('.pdf');
    return !isPdf && fileName.length > 0;
  });

  // 1) If there is a PDF offer attached, we do NOT auto-respond (offer will be processed).
  if (hasPdfAttachment) {
    console.log('[Email Classifier] PDF attachment detected -> none mode (no auto-response)');
    return 'none';
  }

  // 2) If there are non-PDF attachments (images, documents etc), use normal AI response
  // These might contain relevant information that shouldn't trigger "send PDF" request
  if (hasNonPdfAttachment) {
    console.log('[Email Classifier] Non-PDF attachment detected -> normal mode (AI response)');
    return 'normal';
  }

  // 3) Filter out spam/system mails - no auto-response
  if (/noreply|no-reply|do not reply|unsubscribe|denne mail er sendt automatisk/i.test(body)) {
    console.log('[Email Classifier] Spam/system mail detected -> none mode');
    return 'none';
  }

  // 4) Very short messages -> no auto-response
  if (body.trim().length < 20) {
    console.log('[Email Classifier] Message too short -> none mode');
    return 'none';
  }

  // 5) MitID / self-service mail without PDF => special MitID response mode
  if (isMitIdOnlyEmail(body)) {
    console.log('[Email Classifier] Detected MitID/selvbetjening without PDF -> mitid mode');
    return 'mitid';
  }

  // 6) Default for emails without attachments -> request PDF attachment
  console.log('[Email Classifier] Email without attachments -> request_pdf mode');
  return 'request_pdf';
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

      // Determine response mode
      const responseMode = context.responseMode || 'normal';
      console.log(`[AI Response] Response mode: ${responseMode}`);

      // Build response mode specific instructions
      let responseModeInstructions = '';
      if (responseMode === 'mitid') {
        responseModeInstructions = `
**VIGTIGT - MITID/SELVBETJENING SVAR:**
Selskabet har henvist til MitID, selvbetjening, kundeportal eller lignende UDEN at vedhæfte et konkret tilbud som PDF.
Du SKAL:
1. Takke kort for deres svar
2. Forklare høfligt men tydeligt at BedreTilbud arbejder på vegne af kunden
3. Forklare at vi ikke kan bruge MitID-login eller selvbetjeningslinks alene
4. Bede dem eksplicit om at sende det fulde, konkrete tilbud som PDF vedhæftet deres svar på denne mail
5. Holde svaret kort og professionelt (maks. 8-10 linjer)
`;
      } else {
        responseModeInstructions = `
**Response Mode: Normal**
Skriv et normalt opfølgende svar baseret på indholdet af deres mail.
`;
      }

      // Build the user message
      const userMessage = `
**Company Name:** ${context.companyName}

**User Context:**
${JSON.stringify(userContext, null, 2)}

**Conversation History:**
${conversationText}

**New Message from ${context.companyName}:**
${context.incomingMessage}

${responseModeInstructions}

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

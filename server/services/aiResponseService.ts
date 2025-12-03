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

export type AutoRespondMode = 'none' | 'normal' | 'mitid' | 'request_pdf' | 'request_pdf_has_files' | 'user_info_request';

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

interface UserInfoRequestResult {
  isRequest: boolean;
  requestedFields: {
    cpr: boolean;
    address: boolean;
    phone: boolean;
    name: boolean;
  };
}

function detectUserInfoRequest(body: string): UserInfoRequestResult {
  const lower = body.toLowerCase();
  
  const result: UserInfoRequestResult = {
    isRequest: false,
    requestedFields: {
      cpr: false,
      address: false,
      phone: false,
      name: false
    }
  };

  // Request verbs that indicate the company is ASKING for information
  const requestVerbs = /(?:må vi|kan du|kan i|venligst|bedes|skal vi have|mangler vi|har brug for|send os|oplys|oplyse)/;
  
  // CPR-specific patterns - must include request verb context OR explicit CPR request phrase
  // These phrases are very specific and unlikely to appear in non-request contexts
  const cprPatterns = [
    /(?:må vi|kan du|kan i|venligst|bedes|mangler|har brug for|send).{0,30}cpr/i,
    /cpr[- ]?(?:nummer|nr)/i, // CPR-nummer is only used when requesting/discussing CPR
    /personnummer/i, // Personnummer is very specific to requesting ID
    /oplyse.{0,20}cpr/i,
  ];
  
  // Address patterns - require explicit request verb + address
  const addressPatterns = [
    /(?:må vi|kan du|kan i|venligst|bedes|mangler|har brug for|send).{0,30}adresse/i,
    /oplyse.{0,20}(?:din|jeres|kundens).{0,10}adresse/i,
    /hvilken adresse.{0,20}(?:har|bor|skal)/i,
  ];
  
  // Phone patterns - require explicit request verb + phone
  const phonePatterns = [
    /(?:må vi|kan du|kan i|venligst|bedes|mangler|har brug for|send).{0,30}(?:telefon|mobil)/i,
    /oplyse.{0,20}(?:telefon|mobil)/i,
  ];
  
  // Name patterns - require explicit request
  const namePatterns = [
    /(?:må vi|kan du|kan i|venligst|bedes|mangler|har brug for).{0,30}(?:fulde navn|navn)/i,
    /oplyse.{0,20}(?:fulde navn|navn)/i,
  ];

  // Check each category - only match if explicit request patterns are found
  if (cprPatterns.some(p => p.test(lower))) {
    result.requestedFields.cpr = true;
    result.isRequest = true;
    console.log('[UserInfoDetect] CPR request detected');
  }
  
  if (addressPatterns.some(p => p.test(lower))) {
    result.requestedFields.address = true;
    result.isRequest = true;
    console.log('[UserInfoDetect] Address request detected');
  }
  
  if (phonePatterns.some(p => p.test(lower))) {
    result.requestedFields.phone = true;
    result.isRequest = true;
    console.log('[UserInfoDetect] Phone request detected');
  }
  
  if (namePatterns.some(p => p.test(lower))) {
    result.requestedFields.name = true;
    result.isRequest = true;
    console.log('[UserInfoDetect] Name request detected');
  }

  return result;
}

function isUserInfoRequestEmail(body: string): boolean {
  return detectUserInfoRequest(body).isRequest;
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
    // Consider attachment as non-PDF if it has a filename OR a mimeType that isn't PDF
    // This handles inline images (logos etc.) that may have empty filenames
    const hasContent = fileName.length > 0 || type.length > 0;
    return !isPdf && hasContent;
  });

  // 1) If there is a PDF offer attached, we do NOT auto-respond (offer will be processed).
  if (hasPdfAttachment) {
    console.log('[Email Classifier] PDF attachment detected -> none mode (no auto-response)');
    return 'none';
  }

  // 2) If there are non-PDF attachments (images, documents etc), request PDF with acknowledgment
  // This acknowledges they sent files but explains we can only process PDF format
  if (hasNonPdfAttachment) {
    console.log('[Email Classifier] Non-PDF attachment detected -> request_pdf_has_files mode');
    return 'request_pdf_has_files';
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

  // 6) User info request (CPR, address, phone) => provide user information
  if (isUserInfoRequestEmail(body)) {
    console.log('[Email Classifier] Detected user info request (CPR/address/phone) -> user_info_request mode');
    return 'user_info_request';
  }

  // 7) Default for emails without attachments -> request PDF attachment
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
      const documents = await storage.getUserDocuments(context.userId);
      const currentPolicy = documents.find(d => d.documentType === 'current');

      // Build user context for the AI - includes CPR for when insurance company requests it
      const userContext = {
        name: user.name || user.email,
        cprNumber: user.personalIdNumber || null,
        address: user.address || null,
        phone: user.phone,
        age: user.age,
        housingType: user.housingType,
        hasCar: user.hasCar,
        deductible: user.deductible,
        additionalInfo: user.additionalInfo,
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
4. Bede dem eksplicit om at sende det fulde, konkrete tilbud som PDF vedhæftet deres srav på denne mail
5. Holde svaret kort og professionelt (maks. 8-10 linjer)
`;
      } else if (responseMode === 'user_info_request') {
        // Detect which specific fields were requested
        const infoRequest = detectUserInfoRequest(context.incomingMessage);
        const requestedFields: string[] = [];
        
        if (infoRequest.requestedFields.cpr && userContext.cprNumber) {
          requestedFields.push(`- CPR-nummer: ${userContext.cprNumber}`);
        }
        if (infoRequest.requestedFields.name && userContext.name) {
          requestedFields.push(`- Navn: ${userContext.name}`);
        }
        if (infoRequest.requestedFields.address && userContext.address) {
          requestedFields.push(`- Adresse: ${userContext.address}`);
        }
        if (infoRequest.requestedFields.phone && userContext.phone) {
          requestedFields.push(`- Telefonnummer: ${userContext.phone}`);
        }
        
        const fieldsText = requestedFields.length > 0 
          ? `\n\nDE ANMODEDE OPLYSNINGER (inkluder KUN disse i svaret):\n${requestedFields.join('\n')}`
          : '\n\nOBS: De anmodede oplysninger er ikke tilgængelige i systemet. Bed selskabet om at kontakte kunden direkte.';
        
        responseModeInstructions = `
**VIGTIGT - ANMODNING OM BRUGEROPLYSNINGER:**
Forsikringsselskabet har bedt om specifikke brugeroplysninger.
Du SKAL:
1. Takke kort for deres svar
2. Give KUN de oplysninger der er anført nedenfor - inkluder IKKE andre personlige oplysninger
3. Bed også om at de sender tilbuddet som PDF vedhæftet deres svar
4. Skriv ALTID på dansk
5. Hold svaret kort og professionelt (maks. 8-10 linjer)
${fieldsText}

EKSEMPEL FORMAT:
"Hej [Selskab],

Tak for jeres svar.

Her er de ønskede oplysninger:
[Kun de anmodede felter fra listen ovenfor]

Venligst send tilbuddet som PDF vedhæftet jeres svar på denne mail.

Venlig hilsen
BedreTilbud"
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

Generer et svar efter retningslinjerne i system prompten. Husk:
- Skriv ALTID på dansk - uanset hvilket sprog selskabet skriver på
- Vær kort og præcis (maks. 150 ord normalt)
- Brug kun information fra user context
- Hvis de beder om CPR-nummer eller andre personlige oplysninger, giv dem fra user context
- Eskaler hvis nødvendigt (prisfastsættelse, følsomme data, juridiske spørgsmål)
- Returner KUN email-brødteksten, ingen headers eller formatering
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

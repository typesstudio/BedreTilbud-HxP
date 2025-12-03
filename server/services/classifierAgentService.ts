import OpenAI from "openai";
import { z } from "zod";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000,
  maxRetries: 2,
});

export const classifierOutputSchema = z.object({
  intent: z.enum([
    "missing_pdfs",
    "mitid_only",
    "need_cpr",
    "need_address",
    "need_phone",
    "need_user_info",
    "general_question",
    "offer_received",
    "rejection",
    "follow_up",
    "confirmation",
    "unknown"
  ]),
  intentDescription: z.string(),
  mustAskForCpr: z.boolean(),
  mustRequestPdfs: z.boolean(),
  mustAskForAddress: z.boolean(),
  mustAskForPhone: z.boolean(),
  shouldAnswerQuestion: z.boolean(),
  riskFlags: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type ClassifierOutput = z.infer<typeof classifierOutputSchema>;

const CLASSIFIER_SYSTEM_PROMPT = `Du er en AI-klassificeringsagent for BedreTilbud, en dansk forsikringssammenligningsplatform.

Din opgave er at analysere indkommende emails fra forsikringsselskaber og klassificere dem.

RETURNER KUN JSON - ingen anden tekst.

Analyser emailen og returner følgende struktur:
{
  "intent": "<intent_type>",
  "intentDescription": "<kort beskrivelse af hvad emailen handler om>",
  "mustAskForCpr": <true/false>,
  "mustRequestPdfs": <true/false>,
  "mustAskForAddress": <true/false>,
  "mustAskForPhone": <true/false>,
  "shouldAnswerQuestion": <true/false>,
  "riskFlags": ["<eventuelle risikoflag>"],
  "confidence": <0.0-1.0>
}

INTENT TYPER:
- "missing_pdfs": Selskabet har ikke sendt PDF-tilbud eller nævner kun links
- "mitid_only": Selskabet henviser til MitID, selvbetjening eller kundeportal uden PDF
- "need_cpr": Selskabet beder eksplicit om CPR-nummer eller personnummer
- "need_address": Selskabet beder eksplicit om adresse
- "need_phone": Selskabet beder eksplicit om telefonnummer
- "need_user_info": Selskabet beder om generelle brugeroplysninger
- "general_question": Selskabet stiller et generelt spørgsmål
- "offer_received": Selskabet har sendt et tilbud (PDF vedhæftet)
- "rejection": Selskabet afviser at give tilbud
- "follow_up": Opfølgningsmail uden specifik anmodning
- "confirmation": Bekræftelse af modtagelse
- "unknown": Kan ikke klassificeres

RISIKOFLAG eksempler:
- "mentions_competitor": Nævner andre forsikringsselskaber
- "requests_sensitive_data": Beder om følsomme data ud over standard
- "legal_content": Indeholder juridisk indhold
- "pricing_discussion": Diskuterer priser detaljeret

REGLER:
- mustAskForCpr = true KUN hvis selskabet EKSPLICIT beder om CPR/personnummer
- mustRequestPdfs = true hvis selskabet IKKE har sendt PDF og kun henviser til links/portaler
- mustAskForAddress = true KUN hvis selskabet EKSPLICIT beder om adresse
- mustAskForPhone = true KUN hvis selskabet EKSPLICIT beder om telefonnummer
- shouldAnswerQuestion = true hvis selskabet stiller et direkte spørgsmål der kræver svar
- confidence = din sikkerhed på klassificeringen (0.0-1.0)`;

export class ClassifierAgentService {
  async classifyEmail(emailBody: string, context?: {
    companyName?: string;
    previousMessages?: string[];
    hasAttachments?: boolean;
    attachmentTypes?: string[];
  }): Promise<ClassifierOutput> {
    console.log("[ClassifierAgent] Analyzing email...");

    const contextInfo = context ? `
KONTEKST:
- Selskab: ${context.companyName || "Ukendt"}
- Har vedhæftede filer: ${context.hasAttachments ? "Ja" : "Nej"}
- Filtyper: ${context.attachmentTypes?.join(", ") || "Ingen"}
- Tidligere beskeder i tråden: ${context.previousMessages?.length || 0}
` : "";

    const userMessage = `${contextInfo}
EMAIL INDHOLD:
${emailBody}

Analyser denne email og returner JSON-klassificering.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: CLASSIFIER_SYSTEM_PROMPT },
          { role: "user", content: userMessage }
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from classifier");
      }

      const parsed = JSON.parse(content);
      const validated = classifierOutputSchema.parse(parsed);

      console.log(`[ClassifierAgent] Classified as: ${validated.intent} (confidence: ${validated.confidence})`);
      console.log(`[ClassifierAgent] Flags - CPR: ${validated.mustAskForCpr}, PDFs: ${validated.mustRequestPdfs}`);

      return validated;
    } catch (error) {
      console.error("[ClassifierAgent] Classification failed:", error);
      
      return {
        intent: "unknown",
        intentDescription: "Klassificering fejlede",
        mustAskForCpr: false,
        mustRequestPdfs: false,
        mustAskForAddress: false,
        mustAskForPhone: false,
        shouldAnswerQuestion: false,
        riskFlags: ["classification_failed"],
        confidence: 0
      };
    }
  }

  getIntentLabel(intent: ClassifierOutput["intent"]): string {
    const labels: Record<ClassifierOutput["intent"], string> = {
      missing_pdfs: "Mangler PDF-tilbud",
      mitid_only: "Kun MitID/selvbetjening",
      need_cpr: "Anmoder om CPR",
      need_address: "Anmoder om adresse",
      need_phone: "Anmoder om telefon",
      need_user_info: "Anmoder om brugerinfo",
      general_question: "Generelt spørgsmål",
      offer_received: "Tilbud modtaget",
      rejection: "Afvisning",
      follow_up: "Opfølgning",
      confirmation: "Bekræftelse",
      unknown: "Ukendt"
    };
    return labels[intent] || intent;
  }
}

export const classifierAgentService = new ClassifierAgentService();

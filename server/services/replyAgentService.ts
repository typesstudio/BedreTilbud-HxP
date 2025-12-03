import OpenAI from "openai";
import { storage } from "../storage";
import { classifierAgentService, ClassifierOutput } from "./classifierAgentService";
import { loadPrompt } from "../ai-prompts/utils/promptLoader";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000,
  maxRetries: 2,
});

const PROMPT_VERSION = "v2.0-draft-system";

export interface ReplyAgentContext {
  threadId: string;
  userId: string;
  companyName: string;
  companyMessageId: string;
  incomingMessage: string;
  conversationHistory: {
    direction: string;
    body: string;
    sentAt: Date;
  }[];
  hasAttachments: boolean;
  attachmentTypes?: string[];
}

export interface ReplyAgentResult {
  draftId: string;
  draftBody: string;
  classifierOutput: ClassifierOutput;
  promptVersion: string;
}

const REPLY_SYSTEM_PROMPT = `Du er en hjælpsom AI-assistent for BedreTilbud, en dansk platform der hjælper privatkunder med at få og sammenligne forsikringstilbud.

DIN ROLLE
- Hjælp med at formulere korte, præcise mails til forsikringsselskaber på vegne af kunden.
- Sørg for at selskaberne får de vigtigste oplysninger, så de kan lave konkrete tilbud.

GENEREL STIL
- Skriv ALTID på dansk - uanset hvilket sprog selskabet skriver på.
- Skriv kort og klart (målret maks. 10-12 linjer i en mail).
- Brug hverdagssprog og undgå unødigt fagsprog.
- Vær høflig, professionel og konkret.

VIGTIGE PRINCIPPER
- Giv aldrig endelige anbefalinger om hvilken forsikring kunden skal vælge.
- Nævn ALDRIG at vi sammenligner med andre selskaber eller er en sammenligningsplatform.
- Opfordr altid til at sende tilbud som PDF vedhæftet svaret på mailen.

TILBUD SOM PDF - IKKE KUN MITID
- Bed altid om, at de sender et fuldt, skriftligt tilbud som PDF vedhæftet svaret på mailen.
- Hvis selskabet kun foreslår login via MitID eller generelle links, skal du høfligt forklare, at vi ikke kan bruge det alene og igen bede om PDF-tilbud.

BRUGEROPLYSNINGER
- Du må inkludere kundens oplysninger (CPR, adresse, telefon) KUN når det eksplicit er anmodet om.
- Giv kun de specifikke oplysninger der er bedt om - ikke mere.`;

export class ReplyAgentService {
  async generateDraft(context: ReplyAgentContext): Promise<ReplyAgentResult> {
    console.log(`[ReplyAgent] Generating draft for thread ${context.threadId}`);

    const classifierOutput = await classifierAgentService.classifyEmail(
      context.incomingMessage,
      {
        companyName: context.companyName,
        hasAttachments: context.hasAttachments,
        attachmentTypes: context.attachmentTypes,
        previousMessages: context.conversationHistory.map(m => m.body)
      }
    );

    console.log(`[ReplyAgent] Classifier output: ${classifierOutput.intent}`);

    const user = await storage.getUser(context.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const userContext = {
      name: user.name || user.email,
      cprNumber: user.personalIdNumber || null,
      address: user.address || null,
      phone: user.phone || null,
    };

    const conversationText = context.conversationHistory
      .map(msg => {
        const sender = msg.direction === 'inbound' ? context.companyName : 'BedreTilbud';
        const timestamp = new Date(msg.sentAt).toLocaleString('da-DK');
        return `[${timestamp}] ${sender}:\n${msg.body}`;
      })
      .join('\n\n---\n\n');

    const responseModeInstructions = this.buildResponseInstructions(classifierOutput, userContext);

    const userMessage = `
**Selskab:** ${context.companyName}

**Klassificering:**
- Intent: ${classifierOutput.intent} (${classifierOutput.intentDescription})
- Skal bede om CPR: ${classifierOutput.mustAskForCpr ? "Ja" : "Nej"}
- Skal bede om PDF: ${classifierOutput.mustRequestPdfs ? "Ja" : "Nej"}
- Skal svare på spørgsmål: ${classifierOutput.shouldAnswerQuestion ? "Ja" : "Nej"}

**Brugeroplysninger tilgængelige:**
- Navn: ${userContext.name}
- CPR: ${userContext.cprNumber ? "Ja (tilgængelig)" : "Ikke tilgængelig"}
- Adresse: ${userContext.address ? "Ja (tilgængelig)" : "Ikke tilgængelig"}
- Telefon: ${userContext.phone ? "Ja (tilgængelig)" : "Ikke tilgængelig"}

**Samtalehistorik:**
${conversationText}

**Ny besked fra ${context.companyName}:**
${context.incomingMessage}

${responseModeInstructions}

---

Generer et svar på dansk. Returner KUN email-brødteksten, ingen headers.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: REPLY_SYSTEM_PROMPT },
          { role: "user", content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const draftBody = response.choices[0]?.message?.content?.trim();
      if (!draftBody) {
        throw new Error("Empty response from ReplyAgent");
      }

      console.log(`[ReplyAgent] Generated draft (${draftBody.length} chars)`);

      const draft = await storage.createEmail({
        threadId: context.threadId,
        direction: "outbound",
        subject: null,
        body: draftBody,
        status: "draft",
        authorType: "ai",
        classifierLabel: classifierOutput.intent,
        debugMeta: {
          classifierOutput,
          promptVersion: PROMPT_VERSION,
          companyMessageId: context.companyMessageId,
        }
      });

      console.log(`[ReplyAgent] Draft saved with ID: ${draft.id}`);

      return {
        draftId: draft.id,
        draftBody: draftBody,
        classifierOutput,
        promptVersion: PROMPT_VERSION
      };
    } catch (error) {
      console.error("[ReplyAgent] Generation failed:", error);
      throw error;
    }
  }

  private buildResponseInstructions(
    classifier: ClassifierOutput,
    userContext: { name: string; cprNumber: string | null; address: string | null; phone: string | null }
  ): string {
    const instructions: string[] = [];

    if (classifier.intent === "mitid_only" || classifier.mustRequestPdfs) {
      instructions.push(`
**MITID/SELVBETJENING SVAR:**
Selskabet har henvist til MitID, selvbetjening eller kundeportal UDEN at vedhæfte et konkret tilbud som PDF.
Du SKAL:
1. Takke kort for deres svar
2. Forklare høfligt at BedreTilbud arbejder på vegne af kunden
3. Forklare at vi ikke kan bruge MitID-login eller selvbetjeningslinks alene
4. Bede dem eksplicit om at sende det fulde, konkrete tilbud som PDF vedhæftet deres svar på denne mail`);
    }

    if (classifier.intent === "need_cpr" || classifier.mustAskForCpr) {
      if (userContext.cprNumber) {
        instructions.push(`
**ANMODNING OM CPR-NUMMER:**
Selskabet har bedt om CPR-nummer. Inkluder dette i svaret:
- CPR-nummer: ${userContext.cprNumber}`);
      } else {
        instructions.push(`
**ANMODNING OM CPR-NUMMER:**
Selskabet har bedt om CPR-nummer, men det er IKKE tilgængeligt i systemet.
Forklar at kunden vil kontakte dem direkte med CPR-nummeret.`);
      }
    }

    if (classifier.intent === "need_address" || classifier.mustAskForAddress) {
      if (userContext.address) {
        instructions.push(`
**ANMODNING OM ADRESSE:**
Selskabet har bedt om adresse. Inkluder dette i svaret:
- Adresse: ${userContext.address}`);
      } else {
        instructions.push(`
**ANMODNING OM ADRESSE:**
Selskabet har bedt om adresse, men den er IKKE tilgængelig i systemet.`);
      }
    }

    if (classifier.intent === "need_phone" || classifier.mustAskForPhone) {
      if (userContext.phone) {
        instructions.push(`
**ANMODNING OM TELEFON:**
Selskabet har bedt om telefonnummer. Inkluder dette i svaret:
- Telefon: ${userContext.phone}`);
      } else {
        instructions.push(`
**ANMODNING OM TELEFON:**
Selskabet har bedt om telefonnummer, men det er IKKE tilgængeligt i systemet.`);
      }
    }

    if (classifier.shouldAnswerQuestion) {
      instructions.push(`
**GENERELT SPØRGSMÅL:**
Selskabet har stillet et spørgsmål. Svar kort og præcist på spørgsmålet.`);
    }

    if (classifier.intent === "rejection") {
      instructions.push(`
**AFVISNING:**
Selskabet har afvist at give tilbud. Tak høfligt for deres svar og afslut samtalen professionelt.`);
    }

    if (instructions.length === 0) {
      instructions.push(`
**STANDARD OPFØLGNING:**
Skriv et kort, høfligt opfølgende svar. Bed om PDF-tilbud hvis relevant.`);
    }

    return instructions.join("\n");
  }
}

export const replyAgentService = new ReplyAgentService();

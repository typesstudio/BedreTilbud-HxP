import OpenAI from 'openai';
import { z } from 'zod';
import { 
  getStepProfile, 
  getModelMetadata, 
  calculateCost, 
  logAiInvocation,
  type ModelId 
} from '../config/aiModels';

const policySegmentSchema = z.object({
  policyType: z.string(),
  policySubtype: z.string().optional(),
  rawContent: z.string(),
  metadata: z.object({
    pageSpan: z.string().optional(),
    confidence: z.number().min(0).max(1),
    extractedFields: z.object({
      annualPrice: z.number().optional(),
      monthlyPrice: z.number().optional(),
      insuranceCompany: z.string().optional(),
      policyNumber: z.string().optional(),
      coverageAddress: z.string().optional()
    }),
    notableSections: z.array(z.string())
  })
});

const segmentationResultSchema = z.object({
  segments: z.array(policySegmentSchema),
  summary: z.object({
    totalPolicies: z.number(),
    policyTypes: z.array(z.string()),
    overallConfidence: z.number().min(0).max(1),
    processingNotes: z.string().optional()
  })
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

export interface PolicySegment {
  policyType: string;
  policySubtype?: string;
  rawContent: string;
  metadata: {
    pageSpan?: string;
    confidence: number;
    extractedFields: {
      annualPrice?: number;
      monthlyPrice?: number;
      insuranceCompany?: string;
      policyNumber?: string;
      coverageAddress?: string;
    };
    notableSections: string[];
  };
}

export interface SegmentationResult {
  segments: PolicySegment[];
  summary: {
    totalPolicies: number;
    policyTypes: string[];
    overallConfidence: number;
    processingNotes?: string;
  };
  metadata: {
    modelUsed: ModelId;
    tokensUsed: number;
    costUsd: number;
    latencyMs: number;
  };
}

const SEGMENTATION_SYSTEM_PROMPT = `Du er en ekspert i dansk forsikringsanalyse. Din opgave er at analysere OCR-ekstraheret tekst fra forsikringstilbud og opdele det i separate forsikringspolicer.

VIGTIGE REGLER:
1. Identificer ALLE separate forsikringer i dokumentet (f.eks. Indbo, Fritidshus, Ulykke, Bil, Ansvar)
2. For hver forsikring, udtræk ALT relevant indhold - priser, dækninger, selvrisiko, vilkår
3. Opdel multi-policy dokumenter præcist - hver forsikring skal have sit eget segment
4. Identificer forsikringstype korrekt (brug danske termer: Indbo, Fritidshus, Ulykke, osv.)
5. Marker confidence baseret på hvor klart afgrænsede segmenterne er
6. Identificer notable sections: priser, dækninger, selvrisiko, tilvalg, undtagelser

FORSIKRINGSTYPER DU SKAL GENKENDE:
- Indbo/Indboforsikring
- Hus/Husforsikring  
- Fritidshus/Sommerhus
- Ulykke/Ulykkesforsikring
- Bil/Bilforsikring
- Ansvar/Ansvarsforsikring
- Rejse/Rejseforsikring
- Sygdom/Sundhedsforsikring

DANSK TERMINOLOGI:
- Selvrisiko = deductible
- Dækning = coverage
- Tilvalg = optional add-on
- Forsikringssum = coverage amount
- Præmie = premium`;

const SEGMENTATION_USER_PROMPT = (ocrText: string) => `
Analyser følgende OCR-ekstraheret tekst fra et forsikringstilbud og opdel det i separate forsikringspolicer.

OCR TEKST:
${ocrText}

OPGAVE:
1. Identificer ALLE separate forsikringer i teksten
2. For hver forsikring:
   - Bestem forsikringstype (Indbo, Fritidshus, Ulykke, osv.)
   - Udtræk ALT relevant indhold for den forsikring
   - Find priser (årlig og månedlig hvis tilgængelig)
   - Find forsikringsselskab, policenummer, adresse hvis nævnt
   - Identificer notable sections (priser, dækninger, selvrisiko, tilvalg)
   - Vurder confidence (0.0-1.0) baseret på hvor klar segmenteringen er

3. Lav en overordnet summary:
   - Totalt antal policies fundet
   - Liste over policy types
   - Overall confidence
   - Processing notes hvis der er usikkerhed

SVAR I DETTE JSON FORMAT:
{
  "segments": [
    {
      "policyType": "Indbo",
      "policySubtype": null,
      "rawContent": "... hele teksten for denne forsikring ...",
      "metadata": {
        "pageSpan": "1-3",
        "confidence": 0.95,
        "extractedFields": {
          "annualPrice": 2078.53,
          "monthlyPrice": 173.21,
          "insuranceCompany": "Privatsikring",
          "policyNumber": "9146390312",
          "coverageAddress": "Kong Oscars Gade 42 TV, 2100 København Ø"
        },
        "notableSections": ["Priser", "Grunddækninger og selvrisiko", "Forsikringssummer", "Mulige tilvalg"]
      }
    }
  ],
  "summary": {
    "totalPolicies": 3,
    "policyTypes": ["Indbo", "Fritidshus", "Ulykke"],
    "overallConfidence": 0.92,
    "processingNotes": "Alle tre forsikringer er klart afgrænsede i dokumentet"
  }
}
`;

export async function segmentPolicies(
  ocrText: string,
  documentId: string,
  overrideModelId?: ModelId
): Promise<SegmentationResult> {
  const startTime = Date.now();
  const stepProfile = getStepProfile('policySegmentation');
  const modelId = overrideModelId || stepProfile.modelId;
  const modelMetadata = getModelMetadata(modelId);

  console.log(`[Policy Segmentation] Starting segmentation for document ${documentId} using ${modelId}`);

  try {
    let response: OpenAI.Chat.Completions.ChatCompletion;

    if (modelMetadata.supportsReasoning && stepProfile.reasoningEffort) {
      console.log(`[Policy Segmentation] Using reasoning model with effort: ${stepProfile.reasoningEffort}`);
      response = await openai.chat.completions.create({
        model: 'o1-mini',
        messages: [
          {
            role: 'user',
            content: SEGMENTATION_SYSTEM_PROMPT + '\n\n' + SEGMENTATION_USER_PROMPT(ocrText)
          }
        ],
        reasoning_effort: stepProfile.reasoningEffort as any,
        max_completion_tokens: stepProfile.maxTokens || 16384
      });
    } else {
      response = await openai.chat.completions.create({
        model: modelId,
        messages: [
          { role: 'system', content: SEGMENTATION_SYSTEM_PROMPT },
          { role: 'user', content: SEGMENTATION_USER_PROMPT(ocrText) }
        ],
        temperature: stepProfile.temperature || 0.1,
        max_tokens: stepProfile.maxTokens || 16384,
        response_format: { type: 'json_object' }
      });
    }

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    let parsed;
    try {
      const rawParsed = JSON.parse(content);
      parsed = segmentationResultSchema.parse(rawParsed);
    } catch (validationError: any) {
      console.error('[Policy Segmentation] Validation failed:', validationError);
      throw new Error(`Invalid response format: ${validationError.message}`);
    }
    
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const totalTokens = response.usage?.total_tokens || 0;
    const costUsd = calculateCost(modelId, inputTokens, outputTokens);
    const latencyMs = Date.now() - startTime;

    logAiInvocation({
      step: 'policySegmentation',
      documentId,
      modelId,
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd,
      latencyMs,
      success: true,
      confidenceScore: parsed.summary?.overallConfidence,
      timestamp: new Date()
    });

    const result: SegmentationResult = {
      segments: parsed.segments || [],
      summary: parsed.summary || {
        totalPolicies: 0,
        policyTypes: [],
        overallConfidence: 0
      },
      metadata: {
        modelUsed: modelId,
        tokensUsed: totalTokens,
        costUsd,
        latencyMs
      }
    };

    console.log(
      `[Policy Segmentation] ✓ Found ${result.summary.totalPolicies} policies ` +
      `(${result.summary.policyTypes.join(', ')}) | ` +
      `Confidence: ${(result.summary.overallConfidence * 100).toFixed(1)}% | ` +
      `Cost: $${costUsd.toFixed(4)} | ${latencyMs}ms`
    );

    return result;

  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    
    logAiInvocation({
      step: 'policySegmentation',
      documentId,
      modelId,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      latencyMs,
      success: false,
      errorMessage: error.message,
      timestamp: new Date()
    });

    console.error('[Policy Segmentation] Error:', error);
    throw new Error(`Policy segmentation failed: ${error.message}`);
  }
}

export async function segmentPoliciesWithFallback(
  ocrText: string,
  documentId: string
): Promise<SegmentationResult> {
  const stepProfile = getStepProfile('policySegmentation');
  const modelChain = [stepProfile.modelId, ...(stepProfile.fallbackChain || [])];

  let lastError: Error | null = null;

  for (const modelId of modelChain) {
    try {
      console.log(`[Policy Segmentation] Attempting with model: ${modelId}`);
      return await segmentPolicies(ocrText, documentId, modelId);
    } catch (error: any) {
      console.warn(`[Policy Segmentation] ${modelId} failed: ${error.message}, trying fallback...`);
      lastError = error;
    }
  }

  throw lastError || new Error('All models in fallback chain failed');
}

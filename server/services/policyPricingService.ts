import OpenAI from "openai";
import { loadPrompt, replaceVariables } from "../ai-prompts/utils/promptLoader";
import { retryAICall } from "../utils/retry";
import type { PolicyPricing, PricingSource, PricingConfidenceLevel } from "../types/pricing";
import { PolicyPricingSchema } from "../types/pricing";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000,
  maxRetries: 2,
});

export interface PricingAgentInput {
  policyType: string;
  companyName: string | null;
  currency: "DKK";
  rawText: string;
  fullOcrText?: string; // Added for multi-pass fallback
}

interface RegexPriceMatch {
  amount: number;
  label: string;
  line: string;
}

/**
 * Sanity check: Verify that the extracted annual premium is plausible for the policy type.
 * This prevents obviously wrong prices (e.g., mixing up ulykke 995 kr with fritidshus 5682 kr).
 */
function isPlausibleAnnualPremium(policyType: string, amount: number): { plausible: boolean; reason?: string } {
  const type = policyType.toLowerCase();
  
  // House/summer house insurance: typically 2,000 - 30,000 kr/year
  if (['hus', 'fritidshus', 'villa', 'sommerhus', 'husforsikring'].includes(type)) {
    if (amount < 1500) {
      return { plausible: false, reason: `${type} premium ${amount} kr is suspiciously low (expected 1,500-30,000 kr)` };
    }
    if (amount > 50000) {
      return { plausible: false, reason: `${type} premium ${amount} kr is suspiciously high (expected 1,500-30,000 kr)` };
    }
    return { plausible: true };
  }
  
  // Contents insurance: typically 300 - 5,000 kr/year
  if (['indbo', 'indboforsikring'].includes(type)) {
    if (amount < 200) {
      return { plausible: false, reason: `${type} premium ${amount} kr is suspiciously low (expected 300-5,000 kr)` };
    }
    if (amount > 15000) {
      return { plausible: false, reason: `${type} premium ${amount} kr is suspiciously high (expected 300-15,000 kr)` };
    }
    return { plausible: true };
  }
  
  // Accident insurance: typically 200 - 3,000 kr/year
  if (['ulykke', 'ulykkesforsikring'].includes(type)) {
    if (amount < 100) {
      return { plausible: false, reason: `${type} premium ${amount} kr is suspiciously low (expected 200-3,000 kr)` };
    }
    if (amount > 10000) {
      return { plausible: false, reason: `${type} premium ${amount} kr is suspiciously high (expected 200-10,000 kr)` };
    }
    return { plausible: true };
  }
  
  // Car insurance: typically 2,000 - 20,000 kr/year
  if (['bil', 'bilforsikring', 'auto'].includes(type)) {
    if (amount < 1000) {
      return { plausible: false, reason: `${type} premium ${amount} kr is suspiciously low (expected 2,000-20,000 kr)` };
    }
    if (amount > 40000) {
      return { plausible: false, reason: `${type} premium ${amount} kr is suspiciously high (expected 2,000-40,000 kr)` };
    }
    return { plausible: true };
  }
  
  // Travel insurance: typically 200 - 3,000 kr/year
  if (['rejse', 'rejseforsikring'].includes(type)) {
    if (amount < 100) {
      return { plausible: false, reason: `${type} premium ${amount} kr is suspiciously low (expected 200-3,000 kr)` };
    }
    if (amount > 10000) {
      return { plausible: false, reason: `${type} premium ${amount} kr is suspiciously high (expected 200-10,000 kr)` };
    }
    return { plausible: true };
  }
  
  // Unknown policy type - accept any reasonable positive amount
  if (amount < 50) {
    return { plausible: false, reason: `Premium ${amount} kr is suspiciously low for any insurance type` };
  }
  if (amount > 100000) {
    return { plausible: false, reason: `Premium ${amount} kr is suspiciously high for any insurance type` };
  }
  
  return { plausible: true };
}

/**
 * Parse Danish price format: "1.234,56" or "1234,56" to number
 */
function parseDanishPrice(priceStr: string): number | null {
  try {
    // Remove "kr", "kr.", "DKK", spaces, and currency symbols
    let cleaned = priceStr
      .replace(/kr\.?/gi, '')
      .replace(/dkk/gi, '')
      .replace(/\s+/g, '')
      .trim();
    
    // Handle Danish format: 1.234,56 -> 1234.56
    // Also handle: 1234,56 -> 1234.56
    if (cleaned.includes(',')) {
      // Replace thousand separators (dots) and decimal comma
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
    
    const amount = parseFloat(cleaned);
    if (isNaN(amount) || amount <= 0) return null;
    return amount;
  } catch {
    return null;
  }
}

/**
 * Get policy type synonyms for matching
 */
function getPolicyTypeSynonyms(policyType: string): string[] {
  const type = policyType.toLowerCase();
  
  if (['ulykke', 'ulykkesforsikring'].includes(type)) {
    return ['ulykke', 'ulykkesforsikring', 'ulykkesdækning'];
  }
  if (['indbo', 'indboforsikring'].includes(type)) {
    return ['indbo', 'indboforsikring', 'indbodækning'];
  }
  if (['fritidshus', 'sommerhus'].includes(type)) {
    return ['fritidshus', 'fritidshusforsikring', 'sommerhus', 'sommerhusforsikring'];
  }
  if (['hus', 'villa', 'husforsikring'].includes(type)) {
    return ['hus', 'husforsikring', 'villa', 'villaforsikring', 'parcelhus'];
  }
  if (['bil', 'bilforsikring', 'auto'].includes(type)) {
    return ['bil', 'bilforsikring', 'auto', 'autoforsikring', 'motorkøretøj'];
  }
  if (['rejse', 'rejseforsikring'].includes(type)) {
    return ['rejse', 'rejseforsikring', 'rejsedækning'];
  }
  
  return [type];
}

// ========================================
// PASS 1: Segment-only Regex Extraction
// ========================================

/**
 * Pass 1: Extract price from segment using regex patterns
 * High confidence - direct pattern matching in the policy segment
 */
function extractPriceFromSegmentRegex(segmentText: string, policyType: string): RegexPriceMatch | null {
  console.log(`[Pass1-Regex] Searching for price in segment for ${policyType} (${segmentText.length} chars)`);
  
  // Danish price patterns - most specific to least specific
  const pricePatterns = [
    // "Din pris pr. år: 995,10 kr" or "Din pris pr. år 995,10 kr."
    /din\s+pris\s+pr\.?\s*år[:\s]*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*kr/gi,
    // "Pris pr. år: 995,10 kr"
    /pris\s+pr\.?\s*år[:\s]*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*kr/gi,
    // "Årspris: 995,10 kr"
    /årspris[:\s]*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*kr/gi,
    // "Pris i alt pr. år: 995,10 kr"
    /pris\s+i\s+alt\s+pr\.?\s*år[:\s]*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*kr/gi,
    // "Årlig pris: 995,10 kr"
    /årlig\s+pris[:\s]*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*kr/gi,
    // "Samlet pris pr. år: 995,10 kr"
    /samlet\s+pris\s+pr\.?\s*år[:\s]*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*kr/gi,
    // "Præmie pr. år: 995,10 kr"
    /præmie\s+pr\.?\s*år[:\s]*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*kr/gi,
  ];
  
  for (const pattern of pricePatterns) {
    const match = pattern.exec(segmentText);
    if (match && match[1]) {
      const amount = parseDanishPrice(match[1]);
      if (amount !== null) {
        const sanityCheck = isPlausibleAnnualPremium(policyType, amount);
        if (sanityCheck.plausible) {
          console.log(`[Pass1-Regex] ✅ Found plausible price: ${amount} kr from pattern "${match[0]}"`);
          return {
            amount,
            label: match[0].trim(),
            line: match[0]
          };
        } else {
          console.log(`[Pass1-Regex] ⚠️ Rejected implausible price: ${amount} kr (${sanityCheck.reason})`);
        }
      }
    }
  }
  
  console.log(`[Pass1-Regex] No price found in segment`);
  return null;
}

// ========================================
// PASS 2: Nearby OCR Search
// ========================================

/**
 * Pass 2: Search full OCR text for policy-specific price lines
 * Medium confidence - searches for lines containing both policy type and price
 */
function extractPriceFromNearbyOcr(fullOcrText: string, policyType: string): RegexPriceMatch | null {
  if (!fullOcrText || fullOcrText.length === 0) {
    console.log(`[Pass2-NearbyOCR] No fullOcrText provided, skipping`);
    return null;
  }
  
  console.log(`[Pass2-NearbyOCR] Searching full OCR (${fullOcrText.length} chars) for ${policyType} price`);
  
  const synonyms = getPolicyTypeSynonyms(policyType);
  const lines = fullOcrText.split('\n');
  
  // Find lines that contain both a policy type indicator AND a price
  const candidateLines: { line: string; amount: number; label: string }[] = [];
  
  for (const line of lines) {
    const lineLower = line.toLowerCase();
    
    // Check if line contains policy type synonym
    const containsPolicyType = synonyms.some(syn => lineLower.includes(syn.toLowerCase()));
    if (!containsPolicyType) continue;
    
    // Check for price patterns in the line
    const priceMatch = line.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*kr/i);
    if (!priceMatch) continue;
    
    const amount = parseDanishPrice(priceMatch[1]);
    if (amount === null) continue;
    
    // Check if it's a "pr. år" annual price
    const isAnnual = lineLower.includes('pr. år') || 
                     lineLower.includes('pr år') || 
                     lineLower.includes('årlig') ||
                     lineLower.includes('årspris');
    
    if (isAnnual) {
      const sanityCheck = isPlausibleAnnualPremium(policyType, amount);
      if (sanityCheck.plausible) {
        candidateLines.push({
          line: line.trim(),
          amount,
          label: `NearbyOCR: ${line.substring(0, 80).trim()}`
        });
      }
    }
  }
  
  // If exactly one candidate, use it
  if (candidateLines.length === 1) {
    console.log(`[Pass2-NearbyOCR] ✅ Found unique price: ${candidateLines[0].amount} kr`);
    return candidateLines[0];
  }
  
  if (candidateLines.length > 1) {
    console.log(`[Pass2-NearbyOCR] ⚠️ Multiple candidates found (${candidateLines.length}), deferring to LLM`);
    return null;
  }
  
  // Fallback: search for "Tilbud [PolicyType]" sections followed by "Din pris pr. år"
  const tilbudPattern = new RegExp(`tilbud\\s+(${synonyms.join('|')})`, 'gi');
  let tilbudMatch;
  while ((tilbudMatch = tilbudPattern.exec(fullOcrText)) !== null) {
    // Look for "Din pris pr. år" within 2000 chars after the tilbud header
    const afterTilbud = fullOcrText.substring(tilbudMatch.index, tilbudMatch.index + 2000);
    const priceMatch = afterTilbud.match(/din\s+pris\s+pr\.?\s*år[:\s]*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*kr/i);
    
    if (priceMatch) {
      const amount = parseDanishPrice(priceMatch[1]);
      if (amount !== null) {
        const sanityCheck = isPlausibleAnnualPremium(policyType, amount);
        if (sanityCheck.plausible) {
          console.log(`[Pass2-NearbyOCR] ✅ Found price after "Tilbud ${policyType}": ${amount} kr`);
          return {
            amount,
            label: `After "Tilbud ${policyType}": ${priceMatch[0]}`,
            line: priceMatch[0]
          };
        }
      }
    }
  }
  
  console.log(`[Pass2-NearbyOCR] No price found`);
  return null;
}

// ========================================
// PASS 3: LLM Fallback with Context
// ========================================

/**
 * Pass 3: Use LLM to extract price with full context
 * Lower confidence - AI reasoning required
 */
async function extractPriceWithLLMFallback(
  segmentText: string,
  fullOcrText: string | undefined,
  policyType: string,
  companyName: string | null
): Promise<{ amount: number | null; source: 'segment_llm' | 'global_recovery'; notes: string }> {
  console.log(`[Pass3-LLM] Running LLM fallback for ${policyType}`);
  
  // Extract potential price lines from full OCR for context
  let priceContext = '';
  if (fullOcrText) {
    const lines = fullOcrText.split('\n');
    const priceLines = lines.filter(line => {
      const lineLower = line.toLowerCase();
      return (lineLower.includes('kr') || lineLower.includes('pris')) &&
             /\d+[.,]\d+/.test(line);
    }).slice(0, 20); // Max 20 price lines for context
    priceContext = priceLines.join('\n');
  }
  
  const systemPrompt = `Du er en dansk forsikringsekspert der præcist udtrækker årlige præmier.

OPGAVE: Find den ÅRLIGE pris for SPECIFIKT "${policyType}" forsikring.

KRITISKE REGLER:
1. Find KUN prisen for "${policyType}" - ALDRIG priser fra andre forsikringstyper
2. Søg efter mønstre som:
   - "Din pris pr. år" efterfulgt af et beløb i kr
   - "Årspris: X kr"
   - Delpris-komponenter der skal summeres (fx bygningsbrand + bygningsbeskadigelse + osv.)
3. VIGTIG FOR DELPRISER: Hvis dokumentet viser individuelle dækningspriser under "${policyType}" sektionen:
   - Summer alle delpriserne for at få den årlige totalpris
   - Eksempel: Bygningsbrand 2.758,79 kr + Bygningsbeskadigelse 947,46 kr + ... = Total
4. Konverter månedlige priser til årlige (gang med 12)
5. KRITISK: Returner NULL hvis:
   - Du ikke er 100% sikker på at prisen tilhører "${policyType}"
   - Prisen du finder er under en ANDEN forsikringstype overskrift
   - Du kun finder forsikringssummer (fx "Forsikringssum: 835.600 kr") - det er IKKE præmien

FORSIKRINGSTYPE-SPECIFIKKE HINTS:
- Fritidshus/hus: Se efter dækningspriser (bygningsbrand, bygningsbeskadigelse, etc.) og summer dem
- Ulykke: Se efter enkelt "Din pris pr. år" værdi
- Indbo: Se efter enkelt "Din pris pr. år" værdi eller dækningspriser

RETURNER JSON:
{
  "annualPremium": number | null,
  "reasoning": "string explaining how you found the price",
  "usedFullDocument": boolean
}`;

  const userPrompt = `FORSIKRINGSTYPE: ${policyType}
SELSKAB: ${companyName || 'Ukendt'}

SEGMENT TEKST (primær kilde):
${segmentText.substring(0, 3000)}

${priceContext ? `PRIS-RELATEREDE LINJER FRA HELE DOKUMENTET:
${priceContext}` : ''}

Find den årlige pris for ${policyType} forsikringen.`;

  try {
    const response = await retryAICall(async () => {
      return await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 500,
        temperature: 0.1,
      });
    }, 'pricing-llm-fallback');

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    if (result.annualPremium !== null && result.annualPremium > 0) {
      const sanityCheck = isPlausibleAnnualPremium(policyType, result.annualPremium);
      if (sanityCheck.plausible) {
        console.log(`[Pass3-LLM] ✅ Found price: ${result.annualPremium} kr`);
        return {
          amount: result.annualPremium,
          source: result.usedFullDocument ? 'global_recovery' : 'segment_llm',
          notes: result.reasoning || 'LLM extraction'
        };
      } else {
        console.log(`[Pass3-LLM] ⚠️ Rejected implausible LLM price: ${result.annualPremium} kr`);
      }
    }
    
    console.log(`[Pass3-LLM] No valid price from LLM`);
    return { amount: null, source: 'segment_llm', notes: result.reasoning || 'LLM could not find price' };
    
  } catch (error) {
    console.error(`[Pass3-LLM] Error:`, error);
    return { amount: null, source: 'segment_llm', notes: `LLM error: ${error instanceof Error ? error.message : 'Unknown'}` };
  }
}

// ========================================
// MAIN: Multi-Pass Pricing Pipeline
// ========================================

/**
 * Multi-Pass Pricing Pipeline
 * 
 * Pass 1: Segment-only regex (high confidence)
 * Pass 2: Nearby OCR search (medium confidence)  
 * Pass 3: LLM fallback (lower confidence)
 */
class PolicyPricingService {
  
  async extractPricingForPolicy(input: PricingAgentInput): Promise<PolicyPricing> {
    const { policyType, companyName, rawText, fullOcrText } = input;
    
    console.log(`[MultiPass] Starting pricing extraction for ${policyType} (segment: ${rawText.length} chars, fullOCR: ${fullOcrText?.length || 0} chars)`);
    
    let annualPremium: number | null = null;
    let pricingSource: PricingSource = null;
    let confidenceLevel: PricingConfidenceLevel = 'missing';
    let notes = '';
    
    // ========================================
    // PASS 1: Segment-only Regex
    // ========================================
    const pass1Result = extractPriceFromSegmentRegex(rawText, policyType);
    if (pass1Result) {
      annualPremium = pass1Result.amount;
      pricingSource = 'segment_regex';
      confidenceLevel = 'high';
      notes = `Pass1-Regex: ${pass1Result.label}`;
      
      console.log(`[MultiPass] ✅ Pass 1 SUCCESS: ${annualPremium} kr (${pricingSource})`);
    }
    
    // ========================================
    // PASS 2: Nearby OCR Search (if Pass 1 failed)
    // ========================================
    if (annualPremium === null && fullOcrText) {
      const pass2Result = extractPriceFromNearbyOcr(fullOcrText, policyType);
      if (pass2Result) {
        annualPremium = pass2Result.amount;
        pricingSource = 'nearby_ocr';
        confidenceLevel = 'medium';
        notes = `Pass2-NearbyOCR: ${pass2Result.label}`;
        
        console.log(`[MultiPass] ✅ Pass 2 SUCCESS: ${annualPremium} kr (${pricingSource})`);
      }
    }
    
    // ========================================
    // PASS 3: LLM Fallback (if Pass 1 & 2 failed)
    // ========================================
    if (annualPremium === null) {
      const pass3Result = await extractPriceWithLLMFallback(rawText, fullOcrText, policyType, companyName);
      if (pass3Result.amount !== null) {
        annualPremium = pass3Result.amount;
        pricingSource = pass3Result.source;
        confidenceLevel = 'medium';
        notes = `Pass3-LLM: ${pass3Result.notes}`;
        
        console.log(`[MultiPass] ✅ Pass 3 SUCCESS: ${annualPremium} kr (${pricingSource})`);
      } else {
        notes = `All passes failed. ${pass3Result.notes}`;
        console.log(`[MultiPass] ❌ All passes failed for ${policyType}`);
      }
    }
    
    // Build final pricing result
    const pricingStatus = annualPremium !== null ? 'ok' : 'missing';
    const pricingConfidence = annualPremium !== null 
      ? (confidenceLevel === 'high' ? 95 : confidenceLevel === 'medium' ? 70 : 40)
      : 0;
    
    console.log(`[MultiPass] FINAL for ${policyType}:`, {
      annualPremium,
      pricingSource,
      confidenceLevel,
      pricingStatus
    });
    
    return {
      pricingStatus,
      pricingConfidence,
      annualPremium,
      billingFrequency: 'year',
      rawPrices: annualPremium !== null ? [{
        label: notes,
        amount: annualPremium,
        currency: 'DKK',
        frequency: 'year',
        isPerPolicy: true,
        isTotalForAllPolicies: false
      }] : [],
      bindingMonths: null,
      hasIntroPrice: false,
      introPeriodMonths: null,
      introAnnualPremium: null,
      postBindingIncreasePercent: null,
      notes,
      extractionVersion: 'multipass_v1',
      pricingSource,
      confidenceLevel
    };
  }
  
  /**
   * Legacy method for backward compatibility
   * Uses only segment text (no full OCR fallback)
   */
  async extractPricingForPolicyLegacy(input: Omit<PricingAgentInput, 'fullOcrText'>): Promise<PolicyPricing> {
    return this.extractPricingForPolicy({ ...input, fullOcrText: undefined });
  }
}

export const policyPricingService = new PolicyPricingService();

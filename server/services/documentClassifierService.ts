/**
 * DocumentClassifierService - Step 1.3
 * 
 * Classifies uploaded documents as insurance policies or unknown documents.
 * Uses keyword heuristics to determine if a document is likely an insurance policy.
 */

export interface DocumentClassificationResult {
  kind: 'insurance_policy' | 'unknown';
  confidence: number; // 0-100
  matchedKeywords: string[];
  reason: string;
}

const INSURANCE_KEYWORDS = {
  high: [
    'policenummer',
    'policenr',
    'forsikringsnummer',
    'forsikringspolice',
    'police nr',
    'forsikringsbevis',
    'forsikringsoversigt',
  ],
  medium: [
    'dækningsoversigt',
    'dækningssummer',
    'dækningssum',
    'selvrisiko',
    'præmie',
    'forsikringssum',
    'forsikringspræmie',
    'årlig præmie',
    'månedlig præmie',
    'kunde nr',
    'kundenr',
    'kundenummer',
    'forsikringstager',
    'sikrede',
    'forsikret',
  ],
  low: [
    'indbo',
    'husforsikring',
    'indboforsikring',
    'ulykkesforsikring',
    'bilforsikring',
    'rejseforsikring',
    'fritidshus',
    'ansvarsforsikring',
    'kasko',
    'brand',
    'tyveri',
    'vandskade',
    'stormskade',
  ],
  companies: [
    'tryg',
    'topdanmark',
    'alka',
    'gjensidige',
    'codan',
    'if forsikring',
    'lb forsikring',
    'lærerstandens',
    'popermo',
    'privatsikring',
    'bauta',
    'alm. brand',
    'alm brand',
  ],
};

const NON_INSURANCE_INDICATORS = [
  'kontoudtog',
  'lønseddel',
  'faktura',
  'kvittering',
  'bankkonto',
  'betalingsoversigt',
  'skatteoplysninger',
  'årsopgørelse',
  'forskudsopgørelse',
  'kontooversigt',
  'pengeinstitut',
  'opsigelse', // If it's just a cancellation letter
];

export function classifyDocumentKind(text: string): DocumentClassificationResult {
  if (!text || text.trim().length === 0) {
    return {
      kind: 'unknown',
      confidence: 100,
      matchedKeywords: [],
      reason: 'Tom tekst - ingen indhold at analysere',
    };
  }

  const normalizedText = text.toLowerCase();
  const matchedKeywords: string[] = [];
  let score = 0;

  // Check for high-confidence insurance keywords (+30 points each)
  for (const keyword of INSURANCE_KEYWORDS.high) {
    if (normalizedText.includes(keyword)) {
      matchedKeywords.push(keyword);
      score += 30;
    }
  }

  // Check for medium-confidence insurance keywords (+15 points each)
  for (const keyword of INSURANCE_KEYWORDS.medium) {
    if (normalizedText.includes(keyword)) {
      matchedKeywords.push(keyword);
      score += 15;
    }
  }

  // Check for low-confidence insurance keywords (+5 points each)
  for (const keyword of INSURANCE_KEYWORDS.low) {
    if (normalizedText.includes(keyword)) {
      matchedKeywords.push(keyword);
      score += 5;
    }
  }

  // Check for company names (+20 points each, max 40)
  let companyScore = 0;
  for (const company of INSURANCE_KEYWORDS.companies) {
    if (normalizedText.includes(company)) {
      matchedKeywords.push(company);
      companyScore += 20;
      if (companyScore >= 40) break;
    }
  }
  score += companyScore;

  // Check for non-insurance indicators (-30 points each)
  let nonInsuranceMatches = 0;
  for (const indicator of NON_INSURANCE_INDICATORS) {
    if (normalizedText.includes(indicator)) {
      nonInsuranceMatches++;
      score -= 30;
    }
  }

  // Clamp score between 0 and 100
  const clampedScore = Math.max(0, Math.min(100, score));

  // Threshold: need at least 30 points to be considered insurance
  const threshold = 30;

  if (clampedScore >= threshold) {
    return {
      kind: 'insurance_policy',
      confidence: clampedScore,
      matchedKeywords,
      reason: `Fundet ${matchedKeywords.length} forsikringsrelaterede nøgleord`,
    };
  } else {
    return {
      kind: 'unknown',
      confidence: 100 - clampedScore,
      matchedKeywords,
      reason: nonInsuranceMatches > 0 
        ? 'Dokumentet ligner ikke en forsikringspolice (fundet ikke-forsikrings indikatorer)'
        : 'Dokumentet mangler typiske forsikrings-nøgleord',
    };
  }
}

export function isInsurancePolicy(text: string): boolean {
  return classifyDocumentKind(text).kind === 'insurance_policy';
}

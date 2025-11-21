/**
 * Deterministic Single-Policy Narrative Builder
 * 
 * This module builds comparison narratives deterministically from health check data
 * for single-policy comparisons, eliminating AI hallucinations while maintaining
 * the same output schema as the AI narrative agent.
 * 
 * Used when: policiesWithHealthChecks.length === 1
 * Bypassed when: 2-3 policies (use AI enrichment instead)
 */

import type { AIComparisonNarrative } from "@shared/schema";

export interface SinglePolicyNarrativeInput {
  policyKey: string;
  policyType: string;
  currentCompany: string;
  offerCompany: string;
  costSummary: {
    currentAnnualPremium: number | null;
    offerAnnualPremium: number | null;
    annualSavings: number | null;
    annualSavingsPercent: number | null;
  };
  healthCheckData: {
    current: any;
    offer: any;
  };
}

/**
 * Pure function that builds a single-policy narrative deterministically.
 * 
 * No DB access, no network calls - just pure input → output transformation.
 * Returns the same AIComparisonNarrative shape as the AI agent for seamless integration.
 */
export function buildSinglePolicyNarrative(
  input: SinglePolicyNarrativeInput
): AIComparisonNarrative {
  const {
    policyKey,
    policyType,
    currentCompany,
    offerCompany,
    costSummary,
    healthCheckData,
  } = input;

  const { annualSavings, annualSavingsPercent } = costSummary;

  // Build deterministic explanation based on savings
  const explanation = buildExplanation({
    currentCompany,
    offerCompany,
    policyType,
    annualSavings,
    annualSavingsPercent,
  });

  // Build recommendations from health check data
  const recommendations = buildRecommendations({
    policyType,
    healthCheckData,
  });

  // Build missing information from health check data
  const missingInformation = buildMissingInformation({
    policyType,
    healthCheckData,
  });

  return {
    explanation,
    policyNarratives: [
      {
        policyKey,
        policyType,
        recommendations,
        missingInformation,
      },
    ],
  };
}

/**
 * Build deterministic explanation based on cost comparison
 */
function buildExplanation(params: {
  currentCompany: string;
  offerCompany: string;
  policyType: string;
  annualSavings: number | null;
  annualSavingsPercent: number | null;
}): string {
  const {
    currentCompany,
    offerCompany,
    policyType,
    annualSavings,
    annualSavingsPercent,
  } = params;

  const policyTypeLabel = getPolicyTypeLabel(policyType);

  // Handle missing pricing data
  if (annualSavings == null || annualSavingsPercent == null) {
    return `Vi kan sammenligne dækningerne mellem ${offerCompany} og ${currentCompany} for din ${policyTypeLabel}-forsikring, men prisoplysninger kunne ikke udtrækkes fra tilbuddet. Kontakt venligst ${offerCompany} for at få bekræftet prisen.`;
  }

  const roundedPercent = Math.abs(Math.round(annualSavingsPercent));

  if (annualSavings > 500) {
    // Significant savings
    return `Tilbuddet fra ${offerCompany} er ca. ${roundedPercent}% billigere end din nuværende ${policyTypeLabel}-forsikring hos ${currentCompany} og giver en årlig besparelse på ca. ${Math.round(annualSavings)} kr. De centrale dækninger ser fornuftige ud, men der er et par punkter, du bør få afklaret, før du accepterer tilbuddet.`;
  } else if (annualSavings > 0) {
    // Small savings
    return `Tilbuddet fra ${offerCompany} er lidt billigere end din nuværende ${policyTypeLabel}-forsikring hos ${currentCompany} (ca. ${roundedPercent}% årlig besparelse). Her handler valget primært om forskelle i dækning og serviceniveau.`;
  } else if (annualSavings < -500) {
    // Significantly more expensive
    return `Tilbuddet fra ${offerCompany} er ca. ${roundedPercent}% dyrere end din nuværende ${policyTypeLabel}-forsikring hos ${currentCompany}. Du bør kun overveje skift, hvis dækningen er mærkbart bedre på områder, der er vigtige for dig.`;
  } else if (annualSavings < 0) {
    // Slightly more expensive
    return `Tilbuddet fra ${offerCompany} koster lidt mere end din nuværende ${policyTypeLabel}-forsikring hos ${currentCompany}. Her handler valget primært om forskelle i dækning og serviceniveau.`;
  } else {
    // Same price
    return `Tilbuddet fra ${offerCompany} koster omtrent det samme som din nuværende ${policyTypeLabel}-forsikring hos ${currentCompany}. Her handler valget primært om forskelle i dækning og serviceniveau.`;
  }
}

/**
 * Build recommendations from health check data
 */
function buildRecommendations(params: {
  policyType: string;
  healthCheckData: { current: any; offer: any };
}): string[] {
  const { policyType, healthCheckData } = params;
  const recommendations: string[] = [];

  // Try to extract recommendations from offer health check
  const offerHC = healthCheckData.offer;
  if (offerHC?.recommendations && Array.isArray(offerHC.recommendations)) {
    recommendations.push(...offerHC.recommendations.slice(0, 3));
  }

  // Try to extract from weaknesses
  if (offerHC?.weaknesses && Array.isArray(offerHC.weaknesses)) {
    const weaknessRecs = offerHC.weaknesses
      .slice(0, 2)
      .map((w: any) => `Afklar: ${typeof w === 'string' ? w : w.issue || w.description}`);
    recommendations.push(...weaknessRecs);
  }

  // If still too few, add generic policy-type-specific recommendations
  while (recommendations.length < 3) {
    const generic = getGenericRecommendations(policyType);
    const nextRec = generic[recommendations.length % generic.length];
    if (!recommendations.includes(nextRec)) {
      recommendations.push(nextRec);
    } else {
      break; // Avoid duplicates
    }
  }

  return recommendations.slice(0, 4); // Max 4 recommendations
}

/**
 * Build missing information from health check data
 */
function buildMissingInformation(params: {
  policyType: string;
  healthCheckData: { current: any; offer: any };
}): Array<{ severity: "critical" | "important" | "question"; question: string; explanation: string }> {
  const { policyType, healthCheckData } = params;
  const missingInfo: Array<{
    severity: "critical" | "important" | "question";
    question: string;
    explanation: string;
  }> = [];

  // Try to extract from offer health check
  const offerHC = healthCheckData.offer;
  if (offerHC?.missingInformation && Array.isArray(offerHC.missingInformation)) {
    const extracted = offerHC.missingInformation.map((item: any) => ({
      severity: (item.severity || "question") as "critical" | "important" | "question",
      question: item.question || item.field || "Hvad er de præcise vilkår her?",
      explanation:
        item.explanation ||
        item.reason ||
        "Det er uklart beskrevet i materialet, og det kan have betydning for din dækning.",
    }));
    missingInfo.push(...extracted);
  }

  // If empty, add generic missing info based on policy type
  if (missingInfo.length === 0) {
    missingInfo.push(...getGenericMissingInformation(policyType));
  }

  return missingInfo.slice(0, 3); // Max 3 items
}

/**
 * Get policy type label in Danish
 */
function getPolicyTypeLabel(policyType: string): string {
  const labels: Record<string, string> = {
    hus: "hus",
    indbo: "indbo",
    ulykke: "ulykke",
  };
  return labels[policyType.toLowerCase()] || policyType;
}

/**
 * Generic recommendations per policy type (fallback)
 */
function getGenericRecommendations(policyType: string): string[] {
  const generic: Record<string, string[]> = {
    hus: [
      "Bed om præcisering af selvrisiko ved vandskader og stormskader.",
      "Spørg om der er særlige krav til sikring af huset for at få fuld dækning.",
      "Overvej om du har behov for ekstra dækninger som udvidet rørskadedækning.",
      "Undersøg om dækningen for udhus og carport er høj nok i forhold til den reelle værdi.",
    ],
    indbo: [
      "Tjek om forsikringssummen for indbo passer til værdien af dine ejendele.",
      "Spørg om cykeltyveri er dækket uden for hjemmet og på rejse.",
      "Overvej om du har behov for udvidet elektronikdækning.",
      "Bed om afklaring af loftet for særlige værdigenstande som smykker.",
    ],
    ulykke: [
      "Vurder om invaliditetssummen er høj nok i forhold til din indkomst.",
      "Spørg om der er forskel på dækning ved arbejde og fritid.",
      "Overvej om du har behov for højere dækning ved dødsfald.",
      "Afklar om der er karenstid ved visse typer af skader.",
    ],
  };

  return generic[policyType.toLowerCase()] || [
    "Bed om præcisering af vilkår og undtagelser.",
    "Spørg om der er selvrisiko på visse dækninger.",
    "Overvej om dækningsniveauet matcher dine behov.",
  ];
}

/**
 * Generic missing information per policy type (fallback)
 */
function getGenericMissingInformation(
  policyType: string
): Array<{ severity: "critical" | "important" | "question"; question: string; explanation: string }> {
  const generic: Record<string, Array<{ severity: "critical" | "important" | "question"; question: string; explanation: string }>> = {
    hus: [
      {
        severity: "important",
        question: "Er der et loft for erstatning ved totalskade på huset?",
        explanation:
          "Et loft under genopførelsesværdien kan betyde, at du selv skal betale en del af genopbygningen.",
      },
      {
        severity: "critical",
        question: "Hvad er den præcise selvrisiko ved vandskader og skybrud?",
        explanation:
          "Selvrisikoen er ikke beskrevet tydeligt, og det kan påvirke din egenbetaling ved større skader.",
      },
    ],
    indbo: [
      {
        severity: "important",
        question: "Er der et loft for erstatning på særlige værdigenstande som smykker og elektronik?",
        explanation:
          "Et lavt loft kan betyde, at du ikke får fuld erstatning ved tyveri eller brandskade.",
      },
      {
        severity: "question",
        question: "Gælder cykeldækningen også uden for hjemmet og på rejse?",
        explanation:
          "Det er vigtigt at vide, om dækningen kun gælder hjemme eller også ude.",
      },
    ],
    ulykke: [
      {
        severity: "question",
        question: "Gælder dækningen både i fritid og på arbejde?",
        explanation:
          "Hvis dækningen kun gælder i fritiden, kan du have et hul i din forsikring i arbejdstiden.",
      },
      {
        severity: "important",
        question: "Er der karenstid før dækningen træder i kraft?",
        explanation:
          "Nogle ulykkesforsikringer har karens, hvilket kan forsinke udbetaling ved skader.",
      },
    ],
  };

  return generic[policyType.toLowerCase()] || [
    {
      severity: "question",
      question: "Hvad er de præcise vilkår og undtagelser?",
      explanation:
        "Det er uklart beskrevet i materialet, og det kan have betydning for din dækning.",
    },
  ];
}

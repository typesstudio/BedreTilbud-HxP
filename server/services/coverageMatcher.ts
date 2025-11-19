/**
 * Coverage Matching Utility
 * 
 * Deterministically matches insurance coverages between current and offer policies
 * using normalization, synonym mapping, and fuzzy matching.
 * 
 * This replaces AI-based coverage matching to ensure reliability and testability.
 */

interface CoverageItem {
  coverage: string;
  description?: string;
  value: string;
  status?: string;
  attributes?: {
    sum?: string;
    selvrisiko?: string;
    loft?: string;
    sla?: string;
    noter?: string;
  };
}

interface MatchedCoverageRow {
  coverage: string;
  description: string | null;
  current: {
    value: string;
    limit: string | null;
    selvrisiko: string | null;
    status: string;
  };
  offer: {
    value: string;
    limit: string | null;
    selvrisiko: string | null;
    status: string;
  };
  note: string | null;
}

/**
 * Known coverage name synonyms for Danish insurance
 * Maps variations to canonical name
 */
const COVERAGE_SYNONYMS: Record<string, string> = {
  // Brand variations
  'brand': 'brand',
  'bygningsbrand': 'brand',
  'branddækning': 'brand',
  'brandskade': 'brand',
  'el-skade': 'brand', // Often bundled with brand
  'bygningsbrand, el-skade': 'brand',
  
  // Kasko variations (for car insurance)
  'kasko': 'kasko',
  'kaskoforsikring': 'kasko',
  'fuld kasko': 'kasko',
  'delkasko': 'delkasko',
  
  // Theft variations
  'tyveri': 'tyveri',
  'tyveridækning': 'tyveri',
  'indbotyveri': 'tyveri',
  
  // Water damage
  'vandskade': 'vandskade',
  'vandskader': 'vandskade',
  'stormskade': 'vandskade',
  
  // Liability
  'ansvar': 'ansvar',
  'ansvarsdækning': 'ansvar',
  'privatansvar': 'ansvar',
  'bygningsansvar': 'ansvar',
  'bygningsbeskadigelse, ansvar': 'ansvar',
  
  // Legal assistance
  'retshjælp': 'retshjælp',
  'retshjælpsforsikring': 'retshjælp',
  'retsbeskyttelse': 'retshjælp',
  
  // Accident/injury
  'ulykke': 'ulykke',
  'ulykkesforsikring': 'ulykke',
  'invaliditet': 'ulykke',
  
  // Rot/fungus
  'råd': 'råd og svamp',
  'svamp': 'råd og svamp',
  'råd og svamp': 'råd og svamp',
  'råd, svamp og insekt': 'råd og svamp',
  
  // Pipes/plumbing
  'stikledninger': 'stikledninger',
  'stikledninger og rør': 'stikledninger',
  'rør': 'stikledninger',
  
  // Contents
  'indbo': 'indbo',
  'indboforsikring': 'indbo',
};

/**
 * Normalize coverage name for matching
 * - Lowercase
 * - Remove punctuation
 * - Collapse whitespace
 */
function normalizeCoverageName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:()\[\]{}]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

/**
 * Get canonical coverage name using synonym map
 */
function getCanonicalName(normalizedName: string): string {
  return COVERAGE_SYNONYMS[normalizedName] || normalizedName;
}

/**
 * Calculate simple word overlap similarity (0-1)
 * Used for fuzzy matching when exact match fails
 */
function wordOverlapSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(' '));
  const wordsB = new Set(b.split(' '));
  
  const wordsAArray = Array.from(wordsA);
  const wordsBArray = Array.from(wordsB);
  
  const intersection = new Set(wordsAArray.filter(word => wordsB.has(word)));
  const union = new Set([...wordsAArray, ...wordsBArray]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Find best match for a coverage name in a list
 * Returns index of best match or -1 if no good match found
 */
function findBestMatch(targetName: string, candidates: CoverageItem[], threshold = 0.5): number {
  const normalizedTarget = normalizeCoverageName(targetName);
  const canonicalTarget = getCanonicalName(normalizedTarget);
  
  let bestIndex = -1;
  let bestScore = 0;
  
  candidates.forEach((candidate, index) => {
    const normalizedCandidate = normalizeCoverageName(candidate.coverage);
    const canonicalCandidate = getCanonicalName(normalizedCandidate);
    
    // Exact match on canonical name (best case)
    if (canonicalCandidate === canonicalTarget) {
      bestIndex = index;
      bestScore = 1.0;
      return;
    }
    
    // Fuzzy match using word overlap
    const similarity = wordOverlapSimilarity(normalizedCandidate, normalizedTarget);
    if (similarity > bestScore && similarity >= threshold) {
      bestScore = similarity;
      bestIndex = index;
    }
  });
  
  return bestIndex;
}

/**
 * Match coverages between current and offer policies
 * 
 * Algorithm:
 * 1. Collect all unique coverage names from both sides
 * 2. For each coverage, find best match in current and offer lists
 * 3. Build comparison rows with matched data
 * 4. Unmatched coverages show as "ikke inkluderet" on the other side
 * 
 * @param currentCoverages - Coverage items from current policy health check
 * @param offerCoverages - Coverage items from offer policy health check
 * @returns Array of matched coverage rows for comparison table
 */
export function matchCoverages(
  currentCoverages: CoverageItem[],
  offerCoverages: CoverageItem[]
): MatchedCoverageRow[] {
  // Handle empty inputs
  if (currentCoverages.length === 0 && offerCoverages.length === 0) {
    return [];
  }
  
  // Collect all unique coverage names (normalized)
  const allCoverageNames = new Set<string>();
  
  currentCoverages.forEach(c => {
    const normalized = normalizeCoverageName(c.coverage);
    const canonical = getCanonicalName(normalized);
    allCoverageNames.add(canonical);
  });
  
  offerCoverages.forEach(c => {
    const normalized = normalizeCoverageName(c.coverage);
    const canonical = getCanonicalName(normalized);
    allCoverageNames.add(canonical);
  });
  
  // Build comparison rows for each unique coverage
  const rows: MatchedCoverageRow[] = [];
  const usedCurrentIndices = new Set<number>();
  const usedOfferIndices = new Set<number>();
  
  for (const canonicalName of Array.from(allCoverageNames)) {
    // Find best match in current list
    const currentIndex = currentCoverages.findIndex((c, idx) => {
      if (usedCurrentIndices.has(idx)) return false;
      const normalized = normalizeCoverageName(c.coverage);
      return getCanonicalName(normalized) === canonicalName;
    });
    
    // Find best match in offer list
    const offerIndex = offerCoverages.findIndex((c, idx) => {
      if (usedOfferIndices.has(idx)) return false;
      const normalized = normalizeCoverageName(c.coverage);
      return getCanonicalName(normalized) === canonicalName;
    });
    
    const currentItem = currentIndex >= 0 ? currentCoverages[currentIndex] : null;
    const offerItem = offerIndex >= 0 ? offerCoverages[offerIndex] : null;
    
    // Mark indices as used
    if (currentIndex >= 0) usedCurrentIndices.add(currentIndex);
    if (offerIndex >= 0) usedOfferIndices.add(offerIndex);
    
    // Use display name from whichever side has the coverage
    const displayName = currentItem?.coverage || offerItem?.coverage || canonicalName;
    const description = currentItem?.description || offerItem?.description || null;
    
    // Build current side
    const current = currentItem
      ? {
          value: currentItem.value || 'inkluderet',
          limit: currentItem.attributes?.sum || currentItem.attributes?.loft || null,
          selvrisiko: currentItem.attributes?.selvrisiko || null,
          status: currentItem.status || 'neutral'
        }
      : {
          value: 'ikke inkluderet',
          limit: null,
          selvrisiko: null,
          status: 'warning'
        };
    
    // Build offer side
    const offer = offerItem
      ? {
          value: offerItem.value || 'inkluderet',
          limit: offerItem.attributes?.sum || offerItem.attributes?.loft || null,
          selvrisiko: offerItem.attributes?.selvrisiko || null,
          status: offerItem.status || 'neutral'
        }
      : {
          value: 'ikke inkluderet',
          limit: null,
          selvrisiko: null,
          status: 'error'
        };
    
    // Generate note for significant differences
    let note: string | null = null;
    
    // Only included in offer (new coverage)
    if (!currentItem && offerItem) {
      note = 'Ny dækning i tilbuddet';
    }
    // Only included in current (lost coverage)
    else if (currentItem && !offerItem) {
      note = 'Dækning fjernet i tilbuddet';
    }
    // Both present - check for limit improvements
    else if (currentItem && offerItem && current.limit && offer.limit) {
      const currentLimit = parseFloat(current.limit.replace(/[^\d,]/g, '').replace(',', '.'));
      const offerLimit = parseFloat(offer.limit.replace(/[^\d,]/g, '').replace(',', '.'));
      
      if (!isNaN(currentLimit) && !isNaN(offerLimit)) {
        const diff = offerLimit - currentLimit;
        if (Math.abs(diff) > currentLimit * 0.1) { // >10% difference
          if (diff > 0) {
            note = `Højere dækningssum i tilbuddet`;
          } else {
            note = `Lavere dækningssum i tilbuddet`;
          }
        }
      }
    }
    
    rows.push({
      coverage: displayName,
      description,
      current,
      offer,
      note
    });
  }
  
  // Sort rows: main coverages first (brand, ansvar, indbo), then alphabetically
  const mainCoverages = ['brand', 'ansvar', 'indbo', 'tyveri', 'vandskade', 'kasko', 'ulykke', 'retshjælp'];
  
  rows.sort((a, b) => {
    const aNormalized = normalizeCoverageName(a.coverage);
    const bNormalized = normalizeCoverageName(b.coverage);
    const aCanonical = getCanonicalName(aNormalized);
    const bCanonical = getCanonicalName(bNormalized);
    
    const aIndex = mainCoverages.indexOf(aCanonical);
    const bIndex = mainCoverages.indexOf(bCanonical);
    
    // Both are main coverages - sort by main coverage order
    if (aIndex >= 0 && bIndex >= 0) {
      return aIndex - bIndex;
    }
    
    // Only a is main coverage
    if (aIndex >= 0) return -1;
    
    // Only b is main coverage
    if (bIndex >= 0) return 1;
    
    // Neither is main coverage - sort alphabetically
    return a.coverage.localeCompare(b.coverage, 'da');
  });
  
  return rows;
}

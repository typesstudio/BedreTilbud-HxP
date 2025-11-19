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

export interface MatchedCoverageRow {
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
 * 
 * NOTE: Keys are PRE-NORMALIZED (lowercase, no punctuation, collapsed whitespace)
 * to match the output of normalizeCoverageName()
 */
const COVERAGE_SYNONYMS: Record<string, string> = {
  // Brand variations (normalized)
  'brand': 'brand',
  'bygningsbrand': 'brand',
  'branddækning': 'brand',
  'brandskade': 'brand',
  'elskade': 'brand', // Often bundled with brand (was: el-skade)
  'bygningsbrand elskade': 'brand', // (was: bygningsbrand, el-skade)
  
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
  'bygningsbeskadigelse ansvar': 'ansvar', // (was: bygningsbeskadigelse, ansvar)
  
  // Legal assistance
  'retshjælp': 'retshjælp',
  'retshjælpsforsikring': 'retshjælp',
  'retsbeskyttelse': 'retshjælp',
  
  // Accident/injury
  'ulykke': 'ulykke',
  'ulykkesforsikring': 'ulykke',
  'invaliditet': 'ulykke',
  
  // Rot/fungus (normalized)
  'råd': 'råd og svamp',
  'svamp': 'råd og svamp',
  'råd og svamp': 'råd og svamp',
  'råd svamp og insekt': 'råd og svamp', // (was: råd, svamp og insekt)
  
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
 * - Remove punctuation (including &, /, -)
 * - Collapse whitespace
 */
function normalizeCoverageName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:()\[\]{}&\/-]/g, '') // Remove punctuation including &, /, -
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
 * Build a single comparison row from current and offer coverage items
 */
function buildComparisonRow(
  currentItem: CoverageItem | null,
  offerItem: CoverageItem | null
): MatchedCoverageRow {
  // Use display name from whichever side has the coverage
  const displayName = currentItem?.coverage || offerItem?.coverage || 'Unknown';
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
  
  return {
    coverage: displayName,
    description,
    current,
    offer,
    note
  };
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
  
  const rows: MatchedCoverageRow[] = [];
  const usedCurrentIndices = new Set<number>();
  const usedOfferIndices = new Set<number>();
  
  // Start by matching current coverages to offer coverages
  for (let currentIdx = 0; currentIdx < currentCoverages.length; currentIdx++) {
    if (usedCurrentIndices.has(currentIdx)) continue;
    
    const currentItem = currentCoverages[currentIdx];
    const currentNormalized = normalizeCoverageName(currentItem.coverage);
    const currentCanonical = getCanonicalName(currentNormalized);
    
    // Try exact canonical match first
    let offerIdx = offerCoverages.findIndex((c, idx) => {
      if (usedOfferIndices.has(idx)) return false;
      const normalized = normalizeCoverageName(c.coverage);
      return getCanonicalName(normalized) === currentCanonical;
    });
    
    // If no exact match, try fuzzy matching
    if (offerIdx === -1) {
      const unusedOfferCoverages = offerCoverages.filter((_, idx) => !usedOfferIndices.has(idx));
      offerIdx = findBestMatch(currentItem.coverage, unusedOfferCoverages, 0.4); // 40% similarity threshold
      
      // Convert relative index to absolute index
      if (offerIdx >= 0) {
        const unusedIndices = offerCoverages
          .map((_, idx) => idx)
          .filter(idx => !usedOfferIndices.has(idx));
        offerIdx = unusedIndices[offerIdx];
      }
    }
    
    const offerItem = offerIdx >= 0 ? offerCoverages[offerIdx] : null;
    
    // Mark as used
    usedCurrentIndices.add(currentIdx);
    if (offerIdx >= 0) usedOfferIndices.add(offerIdx);
    
    // Build row
    rows.push(buildComparisonRow(currentItem, offerItem));
  }
  
  // Add remaining unmatched offer coverages
  for (let offerIdx = 0; offerIdx < offerCoverages.length; offerIdx++) {
    if (usedOfferIndices.has(offerIdx)) continue;
    
    const offerItem = offerCoverages[offerIdx];
    rows.push(buildComparisonRow(null, offerItem));
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

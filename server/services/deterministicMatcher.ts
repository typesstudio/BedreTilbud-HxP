import type { Policy } from '@shared/schema';
import type { MatchedPair } from '@shared/schema';

interface ScoredCandidate {
  currentPolicyId: string;
  offerPolicyId: string;
  score: number;
  policyType: string;
}

const SCORE_WEIGHTS = {
  ADDRESS_MATCH: 10,
  PERSON_NAME_MATCH: 8,
  OFFER_NUMBER_MATCH: 5,
};

const MIN_SCORE_THRESHOLD = 1;

function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

function extractAddress(policy: Policy): string {
  const policyId = (policy as any).id || 'unknown';
  
  // Try structured_policy first (Phase 1 PolicyExtractor data)
  const structured = (policy as any).structuredPolicy;
  if (structured) {
    try {
      const structuredData = typeof structured === 'string' ? JSON.parse(structured) : structured;
      if (structuredData?.address) {
        const addr = normalizeString(structuredData.address);
        console.log(`[Matcher] extractAddress from structuredPolicy for ${policyId}: "${addr}"`);
        return addr;
      }
      // structuredPolicy exists but lacks address field - fall through to coverageDetails
    } catch (error) {
      console.warn(`[Matcher] Failed to parse structuredPolicy for ${policyId}:`, error);
      // Fall through to coverageDetails
    }
  }
  
  // Fallback to coverageDetails (legacy or supplementary)
  const details = policy.coverageDetails as any;
  if (details) {
    const address = details.insuredAddress || details.address || '';
    if (address) {
      const addr = normalizeString(address);
      console.log(`[Matcher] extractAddress from coverageDetails for ${policyId}: "${addr}"`);
      return addr;
    }
  }
  
  console.warn(`[Matcher] extractAddress for ${policyId}: no address found in structuredPolicy or coverageDetails`);
  return '';
}

function extractPersonName(policy: Policy): string {
  const policyId = (policy as any).id || 'unknown';
  
  // Try structured_policy first (Phase 1 PolicyExtractor data)
  const structured = (policy as any).structuredPolicy;
  if (structured) {
    try {
      const structuredData = typeof structured === 'string' ? JSON.parse(structured) : structured;
      // PolicyExtractor stores person name in 'person' field
      if (structuredData?.person) {
        return normalizeString(structuredData.person);
      }
      // structuredPolicy exists but lacks person field - fall through to coverageDetails
    } catch (error) {
      console.warn(`[Matcher] Failed to parse structuredPolicy for ${policyId}:`, error);
      // Fall through to coverageDetails
    }
  }
  
  // Fallback to coverageDetails (legacy or supplementary)
  const details = policy.coverageDetails as any;
  if (details) {
    const name = details.insuredPerson || details.personName || '';
    if (name) {
      return normalizeString(name);
    }
  }
  
  return '';
}

function extractOfferNumber(policy: Policy): string {
  const policyId = (policy as any).id || 'unknown';
  
  // Try structured_policy first (Phase 1 PolicyExtractor data)
  const structured = (policy as any).structuredPolicy;
  if (structured) {
    try {
      const structuredData = typeof structured === 'string' ? JSON.parse(structured) : structured;
      if (structuredData?.offerNumber) {
        return normalizeString(structuredData.offerNumber);
      }
      // structuredPolicy exists but lacks offerNumber field - fall through to coverageDetails
    } catch (error) {
      console.warn(`[Matcher] Failed to parse structuredPolicy for ${policyId}:`, error);
      // Fall through to coverageDetails
    }
  }
  
  // Fallback to coverageDetails (legacy or supplementary)
  const details = policy.coverageDetails as any;
  if (details) {
    const offerNum = details.offerNumber || details.tilbudsnummer || '';
    if (offerNum) {
      return normalizeString(offerNum);
    }
  }
  
  return '';
}

function scoreMatch(currentPolicy: Policy, offerPolicy: Policy): number {
  let score = 0;
  
  const currentAddress = extractAddress(currentPolicy);
  const offerAddress = extractAddress(offerPolicy);
  if (currentAddress && offerAddress && currentAddress === offerAddress) {
    score += SCORE_WEIGHTS.ADDRESS_MATCH;
  }
  
  const currentPerson = extractPersonName(currentPolicy);
  const offerPerson = extractPersonName(offerPolicy);
  if (currentPerson && offerPerson && currentPerson === offerPerson) {
    score += SCORE_WEIGHTS.PERSON_NAME_MATCH;
  }
  
  const currentOffer = extractOfferNumber(currentPolicy);
  const offerOffer = extractOfferNumber(offerPolicy);
  if (currentOffer && offerOffer && currentOffer === offerOffer) {
    score += SCORE_WEIGHTS.OFFER_NUMBER_MATCH;
  }
  
  return score;
}

/**
 * Lightweight check for raw matching metadata presence (no normalization/parsing overhead)
 * Returns true if policy has ANY of: address, person name, or offer number in RAW form
 * Does NOT call extraction helpers to avoid O(n²) JSON.parse overhead
 */
function hasRawMatchingMetadata(policy: Policy): boolean {
  const policyId = (policy as any).id || 'unknown';
  
  // Check structured_policy first
  const structured = (policy as any).structuredPolicy;
  if (structured) {
    try {
      const data = typeof structured === 'string' ? JSON.parse(structured) : structured;
      // Check for non-empty raw fields (before normalization)
      if (
        (data?.address && String(data.address).trim()) ||
        (data?.person && String(data.person).trim()) ||
        (data?.offerNumber && String(data.offerNumber).trim())
      ) {
        return true;
      }
    } catch (error) {
      console.warn(`[Matcher] hasRawMatchingMetadata: Failed to parse structuredPolicy for ${policyId}`);
      // Fall through to coverageDetails check
    }
  }
  
  // Check coverageDetails fallback
  const details = policy.coverageDetails as any;
  if (details) {
    if (
      (details.insuredAddress && String(details.insuredAddress).trim()) ||
      (details.address && String(details.address).trim()) ||
      (details.insuredPerson && String(details.insuredPerson).trim()) ||
      (details.personName && String(details.personName).trim()) ||
      (details.offerNumber && String(details.offerNumber).trim()) ||
      (details.tilbudsnummer && String(details.tilbudsnummer).trim())
    ) {
      return true;
    }
  }
  
  return false;
}

export function computeBestMatches(
  currentPolicies: Policy[],
  offerPolicies: Policy[]
): {
  pairs: MatchedPair[];
  unmatchedCurrent: string[];
  unmatchedOffer: string[];
  dataQualityError?: string;
} {
  const pairs: MatchedPair[] = [];
  const unmatchedCurrent: Set<string> = new Set();
  const unmatchedOffer: Set<string> = new Set();
  
  // Data quality validation: Check if policies have matching metadata
  const currentWithMetadata = currentPolicies.filter(hasRawMatchingMetadata);
  const offerWithMetadata = offerPolicies.filter(hasRawMatchingMetadata);
  
  if (currentPolicies.length > 0 && currentWithMetadata.length === 0) {
    const error = `All ${currentPolicies.length} current policies lack matching metadata (address/person/offerNumber). Re-upload current policies to populate structured_policy.`;
    console.error(`[Matcher] ${error}`);
    return {
      pairs: [],
      unmatchedCurrent: currentPolicies.map(p => p.id!),
      unmatchedOffer: offerPolicies.map(p => p.id!),
      dataQualityError: error
    };
  }
  
  if (offerPolicies.length > 0 && offerWithMetadata.length === 0) {
    const error = `All ${offerPolicies.length} offer policies lack matching metadata (address/person/offerNumber). Re-upload offer documents to populate structured_policy.`;
    console.error(`[Matcher] ${error}`);
    return {
      pairs: [],
      unmatchedCurrent: currentPolicies.map(p => p.id!),
      unmatchedOffer: offerPolicies.map(p => p.id!),
      dataQualityError: error
    };
  }
  
  const currentByType = new Map<string, Policy[]>();
  for (const policy of currentPolicies) {
    if (!policy.policyType || !policy.id) continue;
    
    if (!currentByType.has(policy.policyType)) {
      currentByType.set(policy.policyType, []);
    }
    currentByType.get(policy.policyType)!.push(policy);
  }
  
  const offerByType = new Map<string, Policy[]>();
  for (const policy of offerPolicies) {
    if (!policy.policyType || !policy.id) continue;
    
    if (!offerByType.has(policy.policyType)) {
      offerByType.set(policy.policyType, []);
    }
    offerByType.get(policy.policyType)!.push(policy);
  }
  
  const allTypes = new Set([
    ...Array.from(currentByType.keys()),
    ...Array.from(offerByType.keys())
  ]);
  
  for (const policyType of Array.from(allTypes)) {
    const currents = currentByType.get(policyType) || [];
    const offers = offerByType.get(policyType) || [];
    
    if (currents.length === 0) {
      offers.forEach(offer => unmatchedOffer.add(offer.id!));
      continue;
    }
    
    if (offers.length === 0) {
      currents.forEach(current => unmatchedCurrent.add(current.id!));
      continue;
    }
    
    const candidates: ScoredCandidate[] = [];
    for (const current of currents) {
      for (const offer of offers) {
        const score = scoreMatch(current, offer);
        candidates.push({
          currentPolicyId: current.id!,
          offerPolicyId: offer.id!,
          score,
          policyType,
        });
      }
    }
    
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      
      if (a.currentPolicyId !== b.currentPolicyId) {
        return a.currentPolicyId.localeCompare(b.currentPolicyId);
      }
      return a.offerPolicyId.localeCompare(b.offerPolicyId);
    });
    
    const usedCurrent = new Set<string>();
    const usedOffer = new Set<string>();
    
    for (const candidate of candidates) {
      if (usedCurrent.has(candidate.currentPolicyId)) continue;
      if (usedOffer.has(candidate.offerPolicyId)) continue;
      
      if (candidate.score < MIN_SCORE_THRESHOLD) {
        break;
      }
      
      const policyTypeLabel = getPolicyTypeLabel(policyType);
      
      pairs.push({
        policyType: policyType as any,
        label: policyTypeLabel,
        currentPolicyId: candidate.currentPolicyId,
        offerPolicyId: candidate.offerPolicyId,
      });
      
      usedCurrent.add(candidate.currentPolicyId);
      usedOffer.add(candidate.offerPolicyId);
    }
    
    // FALLBACK: If exactly 1 current + 1 offer of this type, and no pairs created (score=0 due to missing metadata),
    // create a simple 1:1 match instead of leaving them unmatched
    if (currents.length === 1 && offers.length === 1 && usedCurrent.size === 0 && usedOffer.size === 0) {
      const current = currents[0];
      const offer = offers[0];
      const policyTypeLabel = getPolicyTypeLabel(policyType);
      
      console.log(`[Matcher] FALLBACK: Auto-matching single ${policyType} pair (current ${current.id} ↔ offer ${offer.id}) despite score=0 (missing metadata)`);
      
      pairs.push({
        policyType: policyType as any,
        label: policyTypeLabel,
        currentPolicyId: current.id!,
        offerPolicyId: offer.id!,
      });
      
      usedCurrent.add(current.id!);
      usedOffer.add(offer.id!);
    }
    
    for (const current of currents) {
      if (!usedCurrent.has(current.id!)) {
        unmatchedCurrent.add(current.id!);
      }
    }
    
    for (const offer of offers) {
      if (!usedOffer.has(offer.id!)) {
        unmatchedOffer.add(offer.id!);
      }
    }
  }
  
  return {
    pairs,
    unmatchedCurrent: Array.from(unmatchedCurrent),
    unmatchedOffer: Array.from(unmatchedOffer),
  };
}

function getPolicyTypeLabel(policyType: string): string {
  const labels: Record<string, string> = {
    hus: "Hus",
    indbo: "Indbo",
    ulykke: "Ulykke",
    bil: "Bil",
    rejse: "Rejse",
    andet: "Andet",
  };
  return labels[policyType] || policyType.charAt(0).toUpperCase() + policyType.slice(1);
}

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
  // Try structured_policy first (Phase 1 PolicyExtractor data)
  const structured = (policy as any).structuredPolicy;
  if (structured) {
    const structuredData = typeof structured === 'string' ? JSON.parse(structured) : structured;
    if (structuredData.address) {
      const addr = normalizeString(structuredData.address);
      console.log(`[Matcher] extractAddress from structuredPolicy for ${(policy as any).id}: "${addr}"`);
      return addr;
    }
  }
  
  // Fallback to coverageDetails (legacy)
  const details = policy.coverageDetails as any;
  if (!details) {
    console.log(`[Matcher] extractAddress for ${(policy as any).id}: no address found`);
    return '';
  }
  
  const address = details.insuredAddress || details.address || '';
  const addr = normalizeString(address);
  console.log(`[Matcher] extractAddress from coverageDetails for ${(policy as any).id}: "${addr}"`);
  return addr;
}

function extractPersonName(policy: Policy): string {
  // Try structured_policy first (Phase 1 PolicyExtractor data)
  const structured = (policy as any).structuredPolicy;
  if (structured) {
    const structuredData = typeof structured === 'string' ? JSON.parse(structured) : structured;
    // PolicyExtractor stores person name in 'person' field
    if (structuredData.person) {
      return normalizeString(structuredData.person);
    }
  }
  
  // Fallback to coverageDetails (legacy)
  const details = policy.coverageDetails as any;
  if (!details) return '';
  
  const name = details.insuredPerson || details.personName || '';
  return normalizeString(name);
}

function extractOfferNumber(policy: Policy): string {
  // Try structured_policy first (Phase 1 PolicyExtractor data)
  const structured = (policy as any).structuredPolicy;
  if (structured) {
    const structuredData = typeof structured === 'string' ? JSON.parse(structured) : structured;
    if (structuredData.offerNumber) {
      return normalizeString(structuredData.offerNumber);
    }
  }
  
  // Fallback to coverageDetails (legacy)
  const details = policy.coverageDetails as any;
  if (!details) return '';
  
  const offerNum = details.offerNumber || details.tilbudsnummer || '';
  return normalizeString(offerNum);
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

export function computeBestMatches(
  currentPolicies: Policy[],
  offerPolicies: Policy[]
): {
  pairs: MatchedPair[];
  unmatchedCurrent: string[];
  unmatchedOffer: string[];
} {
  const pairs: MatchedPair[] = [];
  const unmatchedCurrent: Set<string> = new Set();
  const unmatchedOffer: Set<string> = new Set();
  
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

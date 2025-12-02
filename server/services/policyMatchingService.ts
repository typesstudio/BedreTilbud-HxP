import type { IStorage } from '../storage';
import type { Policy, Comparison } from '@shared/schema';
import { ComparisonService } from './comparisonService';
import { insuranceCheckService } from './insuranceCheckService';
import { computeSavings } from '../utils/savingsCalculator';
import { 
  getPolicyTypeLabel, 
  type PolicyMatchStatus, 
  type PolicyMatchRow, 
  type MissingPolicyInfo,
  type CombinedOverviewWithCoverage 
} from '../../shared/apiTypes';

interface MatchedPair {
  currentPolicy: Policy;
  offerPolicy: Policy;
  policyType: string;
}

interface UnmatchedOffer {
  offerPolicy: Policy;
  policyType: string;
}

export class PolicyMatchingService {
  constructor(
    private storage: IStorage,
    private comparisonService: ComparisonService
  ) {}

  async matchAndCompareOfferPolicies(
    userId: string,
    companyId: string,
    offerDocumentId: string,
    offerPolicies: Policy[]
  ): Promise<{
    matchedComparisons: Comparison[];
    unmatchedHealthChecks: Policy[];
  }> {
    console.log(`[Policy Matching] Starting matching for user ${userId}, company ${companyId}`);
    console.log(`[Policy Matching] Offer contains ${offerPolicies.length} policies`);

    const currentPolicies = await this.storage.getPoliciesByUser(userId);
    const ownPolicies = currentPolicies.filter(p => p.isOwnPolicy);

    console.log(`[Policy Matching] User has ${ownPolicies.length} current policies`);

    const { matched, unmatched } = this.matchPoliciesByType(ownPolicies, offerPolicies);

    console.log(`[Policy Matching] Matched ${matched.length} policy pairs`);
    console.log(`[Policy Matching] Unmatched offers: ${unmatched.length}`);

    const matchedComparisons: Comparison[] = [];
    const unmatchedHealthChecks: Policy[] = [];

    for (const pair of matched) {
      try {
        const comparison = await this.createComparisonForPair(
          userId,
          companyId,
          pair.currentPolicy,
          pair.offerPolicy,
          pair.policyType
        );
        matchedComparisons.push(comparison);
        console.log(`[Policy Matching] ✅ Created comparison for ${pair.policyType}`);
      } catch (error) {
        console.error(`[Policy Matching] ❌ Failed to create comparison for ${pair.policyType}:`, error);
      }
    }

    for (const unmatchedItem of unmatched) {
      try {
        await this.runHealthCheckForUnmatched(unmatchedItem.offerPolicy);
        unmatchedHealthChecks.push(unmatchedItem.offerPolicy);
        console.log(`[Policy Matching] ✅ Ran health check for unmatched ${unmatchedItem.policyType}`);
      } catch (error) {
        console.error(`[Policy Matching] ❌ Failed health check for ${unmatchedItem.policyType}:`, error);
      }
    }

    return {
      matchedComparisons,
      unmatchedHealthChecks
    };
  }

  private matchPoliciesByType(
    currentPolicies: Policy[],
    offerPolicies: Policy[]
  ): {
    matched: MatchedPair[];
    unmatched: UnmatchedOffer[];
  } {
    const matchedList: MatchedPair[] = [];
    const unmatchedList: UnmatchedOffer[] = [];

    const currentByType = new Map<string, Policy>();
    for (const policy of currentPolicies) {
      if (policy.policyType && !currentByType.has(policy.policyType)) {
        currentByType.set(policy.policyType, policy);
      }
    }

    for (const offerPolicy of offerPolicies) {
      const policyType = offerPolicy.policyType;
      if (!policyType) {
        console.warn(`[Policy Matching] ⚠️ Offer policy has no type, skipping`);
        continue;
      }

      const currentPolicy = currentByType.get(policyType);
      if (currentPolicy) {
        matchedList.push({
          currentPolicy,
          offerPolicy,
          policyType
        });
        currentByType.delete(policyType);
      } else {
        unmatchedList.push({
          offerPolicy,
          policyType
        });
      }
    }

    return { matched: matchedList, unmatched: unmatchedList };
  }

  private arePoliciesSimilar(currentPolicy: Policy, offerPolicy: Policy): boolean {
    const currentData = currentPolicy.coverageDetails as any;
    const offerData = offerPolicy.coverageDetails as any;

    if (!currentData || !offerData) return false;

    if (currentData.policyNumber && offerData.policyNumber && currentData.policyNumber === offerData.policyNumber) {
      console.log(`[Policy Matching] ⚠️ Policies have identical policy numbers - same policy`, {
        policyNumber: currentData.policyNumber
      });
      return true;
    }

    const hasPremiumData = currentPolicy.premium && offerPolicy.premium;
    const hasDeductibleData = currentPolicy.deductible && offerPolicy.deductible;
    const hasCompanyData = currentData.company && offerData.company;

    if (!hasPremiumData && !hasDeductibleData && !hasCompanyData) {
      console.log(`[Policy Matching] ℹ️ Insufficient data for similarity check - allowing comparison`);
      return false;
    }

    let matchCount = 0;
    let checkCount = 0;

    if (hasPremiumData) {
      checkCount++;
      const currentPremium = parseFloat(currentPolicy.premium!.toString());
      const offerPremium = parseFloat(offerPolicy.premium!.toString());
      const premiumDiff = Math.abs(currentPremium - offerPremium);
      const premiumTolerance = Math.max(currentPremium, offerPremium) * 0.01;
      
      if (premiumDiff <= premiumTolerance) {
        matchCount++;
        console.log(`[Policy Matching] ℹ️ Premium match detected`, {
          current: currentPremium,
          offer: offerPremium,
          diff: premiumDiff
        });
      }
    }

    if (hasDeductibleData) {
      checkCount++;
      const currentDeductible = parseFloat(currentPolicy.deductible!.toString());
      const offerDeductible = parseFloat(offerPolicy.deductible!.toString());
      
      if (Math.abs(currentDeductible - offerDeductible) < 10) {
        matchCount++;
      }
    }

    if (hasCompanyData) {
      checkCount++;
      const currentCompany = currentData.company.toLowerCase().trim();
      const offerCompany = offerData.company.toLowerCase().trim();
      
      if (currentCompany === offerCompany || 
          currentCompany.includes(offerCompany) || 
          offerCompany.includes(currentCompany)) {
        matchCount++;
      }
    }

    if (matchCount === checkCount && checkCount >= 2) {
      console.log(`[Policy Matching] ⚠️ Policies are highly similar`, {
        matchCount,
        checkCount,
        hasPremiumData,
        hasDeductibleData,
        hasCompanyData
      });
      return true;
    }

    return false;
  }

  private async createComparisonForPair(
    userId: string,
    companyId: string,
    currentPolicy: Policy,
    offerPolicy: Policy,
    policyType: string
  ): Promise<Comparison> {
    console.log(`[Policy Matching] Generating comparison for ${policyType}...`);

    const currentData = currentPolicy.coverageDetails;
    const offerData = offerPolicy.coverageDetails;

    if (!currentData || !offerData) {
      throw new Error(`Missing coverage details for ${policyType} comparison`);
    }

    if (this.arePoliciesSimilar(currentPolicy, offerPolicy)) {
      console.log(`[Policy Matching] ⚠️ Skipping comparison - policies are identical or too similar`);
      throw new Error(`IDENTICAL_POLICIES: The offer for ${policyType} appears to be the same as your current policy`);
    }

    const comparisonResult = await this.comparisonService.compareInsurancePolicies(
      currentData as any,
      offerData as any
    );

    const savingsValue = typeof comparisonResult.savings === 'object' && comparisonResult.savings !== null
      ? (comparisonResult.savings as any).annual
      : comparisonResult.savings;
    
    const savingsNumber = Number(savingsValue);
    const finalSavings = Number.isFinite(savingsNumber) ? savingsNumber : 0;

    const comparison = await this.storage.createComparison({
      userId,
      companyId,
      policyType,
      currentPolicyId: currentPolicy.id,
      offerPolicyId: offerPolicy.id,
      currentDocumentId: currentPolicy.documentId,
      offerDocumentId: offerPolicy.documentId,
      comparisonData: comparisonResult,
      aiRecommendation: comparisonResult.aiRecommendation,
      savings: Math.round(finalSavings)
    });

    console.log(`[Policy Matching] ✅ Comparison created for ${policyType}, savings: ${comparisonResult.savings} DKK`);

    return comparison;
  }

  private async runHealthCheckForUnmatched(offerPolicy: Policy): Promise<void> {
    console.log(`[Policy Matching] Running health check for unmatched ${offerPolicy.policyType}...`);

    const healthCheckResult = await insuranceCheckService.analyzeInsuranceHealth(offerPolicy);

    const rawSavings = healthCheckResult.potentialSavings?.realistic || 0;
    const savingsNumber = Number(rawSavings);
    const savingsAnnual = Number.isFinite(savingsNumber) ? savingsNumber : 0;

    await this.storage.updatePolicyHealthCheck(offerPolicy.id, {
      status: 'completed',
      payload: healthCheckResult,
      savingsAnnual
    });

    console.log(`[Policy Matching] ✅ Health check completed for ${offerPolicy.policyType}`);
  }

  /**
   * Step 4.1: Get combined overview with partial coverage detection
   * 
   * This function:
   * 1. Loads all user's current policies
   * 2. Loads comparisons for the specified company
   * 3. Determines which policies are matched vs missing in the offer
   * 4. Calculates aggregated savings ONLY for matched policies with valid prices
   * 5. Returns coverage flags for UI to display partial coverage warnings
   */
  async getCombinedOverview(userId: string, companyId: string): Promise<CombinedOverviewWithCoverage> {
    console.log(`[Policy Matching] Generating combined overview for user ${userId}, company ${companyId}`);

    // 1. Load all user's current policies (to detect missing coverage)
    const allCurrentPolicies = await this.storage.getPoliciesByUser(userId);
    const currentPolicies = allCurrentPolicies.filter(p => p.isOwnPolicy);
    
    // Build map of current policy types
    const currentPolicyTypes = new Map<string, Policy>();
    for (const policy of currentPolicies) {
      if (policy.policyType && !currentPolicyTypes.has(policy.policyType)) {
        currentPolicyTypes.set(policy.policyType, policy);
      }
    }

    console.log(`[Policy Matching] User has ${currentPolicyTypes.size} current policy types: ${Array.from(currentPolicyTypes.keys()).join(', ')}`);

    // 2. Load comparisons for this company
    const comparisons = await this.storage.getComparisonsByUserAndCompany(userId, companyId);
    
    // Track which policy types have comparisons (matched)
    const matchedPolicyTypes = new Set<string>();
    for (const comparison of comparisons) {
      if (comparison.policyType) {
        matchedPolicyTypes.add(comparison.policyType);
      }
    }

    console.log(`[Policy Matching] Company has ${matchedPolicyTypes.size} matched policy types: ${Array.from(matchedPolicyTypes).join(', ')}`);

    // 3. Build policy matches with status
    const policyMatches: PolicyMatchRow[] = [];
    const missingPolicyTypes: MissingPolicyInfo[] = [];

    // Add matched policies
    for (const comparison of comparisons) {
      const policyType = comparison.policyType || 'unknown';
      const label = getPolicyTypeLabel(policyType);
      
      const currentPolicy = comparison.currentPolicyId 
        ? await this.storage.getPolicy(comparison.currentPolicyId) 
        : null;
      const offerPolicy = comparison.offerPolicyId 
        ? await this.storage.getPolicy(comparison.offerPolicyId) 
        : null;

      const currentPremium = this.extractPremium(currentPolicy);
      const offerPremium = this.extractPremium(offerPolicy);
      const savingsResult = computeSavings(currentPremium, offerPremium);

      policyMatches.push({
        policyType,
        label,
        matchStatus: 'matched',
        currentPolicyId: comparison.currentPolicyId || null,
        offerPolicyId: comparison.offerPolicyId || null,
        currentPremium: savingsResult.currentPremium,
        offerPremium: savingsResult.offerPremium,
        hasPrice: savingsResult.hasPrice
      });
    }

    // Add missing policies (current exists but no offer)
    for (const [policyType, policy] of currentPolicyTypes) {
      if (!matchedPolicyTypes.has(policyType)) {
        const label = getPolicyTypeLabel(policyType);
        const currentPremium = this.extractPremium(policy);

        policyMatches.push({
          policyType,
          label,
          matchStatus: 'missing_in_offer',
          currentPolicyId: policy.id,
          offerPolicyId: null,
          currentPremium,
          offerPremium: null,
          hasPrice: currentPremium !== null
        });

        missingPolicyTypes.push({ policyType, label });
      }
    }

    // Sort by policy type for consistent ordering
    policyMatches.sort((a, b) => a.policyType.localeCompare(b.policyType));
    missingPolicyTypes.sort((a, b) => a.policyType.localeCompare(b.policyType));

    // 4. Calculate aggregated savings ONLY for matched policies with valid prices
    const matchedWithPrice = policyMatches.filter(
      row => row.matchStatus === 'matched' && row.hasPrice
    );

    let totalSavingsAmount: number | null = null;
    let totalCurrentPremium = 0;
    let hasAnyPrice = matchedWithPrice.length > 0;

    if (hasAnyPrice) {
      totalSavingsAmount = 0;
      for (const row of matchedWithPrice) {
        totalSavingsAmount += (row.currentPremium! - row.offerPremium!);
        totalCurrentPremium += row.currentPremium!;
      }
    }

    const totalSavingsPercentage = hasAnyPrice && totalCurrentPremium > 0 
      ? Math.round((totalSavingsAmount! / totalCurrentPremium) * 1000) / 10
      : null;

    // 5. Build quick comparison with match status
    const quickComparison: CombinedOverviewWithCoverage['quickComparison'] = [];
    const highlights: CombinedOverviewWithCoverage['highlights'] = [];
    const comparisonIds: string[] = [];

    let recommendedCount = 0;
    let considerCount = 0;
    let notRecommendedCount = 0;

    for (const comparison of comparisons) {
      comparisonIds.push(comparison.id);
      const data = comparison.comparisonData as any;
      const policyType = comparison.policyType || 'unknown';
      const label = getPolicyTypeLabel(policyType);
      
      const matchRow = policyMatches.find(m => m.policyType === policyType && m.matchStatus === 'matched');
      const savingsResult = matchRow 
        ? computeSavings(matchRow.currentPremium, matchRow.offerPremium)
        : { hasPrice: false, savingsAmount: null };

      if (data?.verdict === 'recommended') recommendedCount++;
      else if (data?.verdict === 'consider') considerCount++;
      else notRecommendedCount++;

      quickComparison.push({
        policyType,
        label,
        currentPremium: matchRow?.currentPremium ?? null,
        offerPremium: matchRow?.offerPremium ?? null,
        savings: savingsResult.savingsAmount,
        hasPrice: savingsResult.hasPrice,
        verdict: data?.verdict || 'consider',
        matchStatus: 'matched'
      });

      if (data?.highlights && Array.isArray(data.highlights)) {
        highlights.push(...data.highlights.slice(0, 2));
      }
    }

    // Add missing policies to quick comparison
    for (const missing of missingPolicyTypes) {
      const matchRow = policyMatches.find(m => m.policyType === missing.policyType && m.matchStatus === 'missing_in_offer');
      
      quickComparison.push({
        policyType: missing.policyType,
        label: missing.label,
        currentPremium: matchRow?.currentPremium ?? null,
        offerPremium: null,
        savings: null,
        hasPrice: false,
        verdict: 'missing',
        matchStatus: 'missing_in_offer'
      });
    }

    // 6. Determine overall verdict
    let overallVerdict: 'recommended' | 'consider' | 'not_recommended' = 'consider';
    if (comparisons.length > 0) {
      if (recommendedCount > comparisons.length / 2) {
        overallVerdict = 'recommended';
      } else if (notRecommendedCount > comparisons.length / 2) {
        overallVerdict = 'not_recommended';
      }
    }

    const coversAllCurrentPolicies = missingPolicyTypes.length === 0;
    const matchedCount = policyMatches.filter(m => m.matchStatus === 'matched').length;

    console.log(`[Policy Matching] Combined overview: ${matchedCount} matched, ${missingPolicyTypes.length} missing, coversAll=${coversAllCurrentPolicies}`);

    return {
      totalSavings: totalSavingsAmount,
      totalSavingsPercentage,
      hasPrice: hasAnyPrice,
      policyCount: currentPolicyTypes.size,
      matchedPolicyCount: matchedCount,
      verdict: overallVerdict,
      highlights: highlights.slice(0, 6),
      quickComparison,
      comparisonIds,
      policyMatches,
      missingPolicyTypes,
      extraOfferPolicies: [], // Step 4.2: Currently empty in legacy matching service
      coversAllCurrentPolicies
    };
  }

  /**
   * Helper to extract premium from policy with fallbacks
   */
  private extractPremium(policy: Policy | null): number | null {
    if (!policy) return null;
    
    // Try direct premium field first
    if (policy.premium) {
      const num = Number(policy.premium);
      if (Number.isFinite(num) && num > 0) return num;
    }

    // Try coverage details
    const details = policy.coverageDetails as any;
    if (details) {
      const premium = details.premium || details.annualPremium;
      if (premium) {
        const num = Number(premium);
        if (Number.isFinite(num) && num > 0) return num;
      }
    }

    return null;
  }
}

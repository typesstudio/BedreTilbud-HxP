import type { IStorage } from '../storage';
import type { Policy, Comparison } from '@shared/schema';
import { ComparisonService } from './comparisonService';
import { insuranceCheckService } from './insuranceCheckService';

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

  async getCombinedOverview(userId: string, companyId: string): Promise<{
    totalSavings: number;
    totalSavingsPercentage: number;
    policyCount: number;
    verdict: 'recommended' | 'consider' | 'not_recommended';
    highlights: Array<{
      title: string;
      description: string;
      icon: string;
      variant: 'success' | 'warning' | 'error';
    }>;
    quickComparison: Array<{
      policyType: string;
      currentPremium: number;
      offerPremium: number;
      savings: number;
      verdict: string;
    }>;
    comparisonIds: string[];
  }> {
    console.log(`[Policy Matching] Generating combined overview for user ${userId}, company ${companyId}`);

    const comparisons = await this.storage.getComparisonsByUserAndCompany(userId, companyId);

    if (comparisons.length === 0) {
      throw new Error('No comparisons found for this company');
    }

    let totalSavings = 0;
    let totalCurrentPremium = 0;
    let totalOfferPremium = 0;
    const highlights: Array<any> = [];
    const quickComparison: Array<any> = [];
    const comparisonIds: string[] = [];

    let recommendedCount = 0;
    let considerCount = 0;
    let notRecommendedCount = 0;

    for (const comparison of comparisons) {
      comparisonIds.push(comparison.id);
      const data = comparison.comparisonData as any;
      
      if (!data) continue;

      const savingsRaw = data.savings;
      const savingsValue = typeof savingsRaw === 'object' && savingsRaw !== null
        ? (savingsRaw.annual || 0)
        : (savingsRaw || 0);
      const savingsNumber = Number(savingsValue);
      const savings = Number.isFinite(savingsNumber) ? savingsNumber : 0;
      totalSavings += savings;

      const currentPolicy = comparison.currentPolicyId ? 
        await this.storage.getPolicy(comparison.currentPolicyId) : null;
      const offerPolicy = comparison.offerPolicyId ? 
        await this.storage.getPolicy(comparison.offerPolicyId) : null;

      const currentDoc = currentPolicy ? await this.storage.getDocument(currentPolicy.documentId) : null;
      const offerDoc = offerPolicy ? await this.storage.getDocument(offerPolicy.documentId) : null;

      const currentPremium = (currentDoc?.ocrData as any)?.premium || 0;
      const offerPremium = (offerDoc?.ocrData as any)?.premium || 0;

      totalCurrentPremium += Number(currentPremium);
      totalOfferPremium += Number(offerPremium);

      if (data.verdict === 'recommended') recommendedCount++;
      else if (data.verdict === 'consider') considerCount++;
      else notRecommendedCount++;

      quickComparison.push({
        policyType: comparison.policyType || 'Unknown',
        currentPremium: Number(currentPremium),
        offerPremium: Number(offerPremium),
        savings: Number.isFinite(savings) ? savings : 0,
        verdict: data.verdict || 'consider'
      });

      if (data.highlights && Array.isArray(data.highlights)) {
        highlights.push(...data.highlights.slice(0, 2));
      }
    }

    const totalSavingsPercentage = totalCurrentPremium > 0 
      ? Math.round((totalSavings / totalCurrentPremium) * 100)
      : 0;

    let overallVerdict: 'recommended' | 'consider' | 'not_recommended' = 'consider';
    if (recommendedCount > comparisons.length / 2) {
      overallVerdict = 'recommended';
    } else if (notRecommendedCount > comparisons.length / 2) {
      overallVerdict = 'not_recommended';
    }

    return {
      totalSavings,
      totalSavingsPercentage,
      policyCount: comparisons.length,
      verdict: overallVerdict,
      highlights: highlights.slice(0, 6),
      quickComparison,
      comparisonIds
    };
  }
}

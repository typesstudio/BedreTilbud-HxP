/**
 * Deterministic highlights generation from coverage and cost differences
 * 
 * Philosophy: Build highlights in code BEFORE calling AI to prevent hallucination
 * AI should only add narrative polish, not invent highlights
 */

import { type Highlight } from "@shared/schema";
import { type MatchedCoverageRow } from "./coverageMatcher";

interface HighlightsInput {
  coverageRows: MatchedCoverageRow[];
  currentAnnualPremium: number;
  offerAnnualPremium: number;
  policyType: string;
}

/**
 * Generate highlights from coverage and cost differences
 * 
 * Priority order:
 * 1. Cost savings (if offer is cheaper)
 * 2. New coverages in offer (not in current)
 * 3. Higher coverage limits in offer
 * 4. Lower deductibles in offer
 * 5. Removed coverages (warnings)
 */
export function generateHighlights(input: HighlightsInput): Highlight[] {
  const highlights: Highlight[] = [];
  const { coverageRows, currentAnnualPremium, offerAnnualPremium, policyType } = input;

  // 1. Cost savings highlight (if significant)
  const annualSavings = currentAnnualPremium - offerAnnualPremium;
  if (annualSavings > 0) {
    const savingsPercent = (annualSavings / currentAnnualPremium) * 100;
    if (savingsPercent >= 5) { // Only show if ≥5% savings
      highlights.push({
        title: "Lavere pris",
        description: `Spar ${Math.round(annualSavings)} kr årligt`,
        icon: "piggy-bank",
        variant: "success",
        category: "price"
      });
    }
  }

  // 2. Analyze coverage differences
  for (const row of coverageRows) {
    // New coverage in offer (not in current)
    if (row.current.value === 'ikke inkluderet' && row.offer.value !== 'ikke inkluderet') {
      highlights.push({
        title: `${row.coverage} inkluderet`,
        description: row.offer.limit ? `Med dækning på ${row.offer.limit}` : 'Ny dækning i tilbuddet',
        icon: getIconForCoverage(row.coverage),
        variant: "success",
        category: "coverage"
      });
    }
    
    // Higher coverage limit in offer
    else if (row.current.limit && row.offer.limit) {
      const currentLimit = parseCurrency(row.current.limit);
      const offerLimit = parseCurrency(row.offer.limit);
      
      if (offerLimit > currentLimit && currentLimit > 0) {
        const diff = offerLimit - currentLimit;
        const diffPercent = (diff / currentLimit) * 100;
        
        if (diffPercent >= 10) { // Only show if ≥10% increase
          highlights.push({
            title: `Højere ${row.coverage.toLowerCase()} dækning`,
            description: formatLimitIncrease(currentLimit, offerLimit),
            icon: "trending-up",
            variant: "success",
            category: "coverage"
          });
        }
      }
    }
    
    // Lower deductible in offer
    if (row.current.selvrisiko && row.offer.selvrisiko) {
      const currentDeductible = parseCurrency(row.current.selvrisiko);
      const offerDeductible = parseCurrency(row.offer.selvrisiko);
      
      if (offerDeductible < currentDeductible && currentDeductible > 0) {
        const diff = currentDeductible - offerDeductible;
        highlights.push({
          title: "Lavere selvrisiko",
          description: `−${formatCurrency(diff)} pr. skade på ${row.coverage.toLowerCase()}`,
          icon: "trending-down",
          variant: "success",
          category: "deductible"
        });
      }
    }
    
    // Coverage removed in offer (warning)
    if (row.current.value !== 'ikke inkluderet' && row.offer.value === 'ikke inkluderet') {
      highlights.push({
        title: `${row.coverage} ikke inkluderet`,
        description: 'Dækning fjernet i tilbuddet',
        icon: "info",
        variant: "warning",
        category: "coverage"
      });
    }
  }

  // Limit to top 4 highlights (matches Tryg design)
  // Prioritize: success > neutral > warning > error
  const sortedHighlights = highlights.sort((a, b) => {
    const variantOrder = { success: 0, neutral: 1, warning: 2, error: 3 };
    return variantOrder[a.variant] - variantOrder[b.variant];
  });

  return sortedHighlights.slice(0, 4);
}

/**
 * Parse currency string to number
 * Handles formats: "1.000 kr", "1.000.000", "1000", "1000 kr"
 */
function parseCurrency(value: string): number {
  if (!value) return 0;
  
  // Remove all non-numeric except commas and dots
  const cleaned = value.replace(/[^\d.,]/g, '');
  
  // Danish format uses . for thousands and , for decimals
  // Convert to standard number format
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  
  return parseFloat(normalized) || 0;
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M kr`;
  } else if (amount >= 1000) {
    return `${Math.round(amount / 1000)}k kr`;
  }
  return `${Math.round(amount)} kr`;
}

/**
 * Format limit increase for display
 */
function formatLimitIncrease(currentLimit: number, offerLimit: number): string {
  const diff = offerLimit - currentLimit;
  return `+${formatCurrency(diff)}`;
}

/**
 * Get appropriate icon for coverage type
 */
function getIconForCoverage(coverageName: string): Highlight['icon'] {
  const name = coverageName.toLowerCase();
  
  if (name.includes('brand')) return 'shield';
  if (name.includes('vandskade') || name.includes('læk')) return 'droplet';
  if (name.includes('bil') || name.includes('kasko')) return 'car';
  if (name.includes('vejhjælp')) return 'truck';
  if (name.includes('hus') || name.includes('bygning')) return 'home';
  if (name.includes('ulykke') || name.includes('invaliditet')) return 'heart';
  if (name.includes('indbo')) return 'home';
  
  return 'check';
}

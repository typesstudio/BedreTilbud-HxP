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
 * Internal type with explicit priority for sorting.
 * 
 * The _priority field (0-4) ensures deterministic ordering:
 * - Lower values sort first (0 = highest priority)
 * - Prevents category/variant confusion (e.g., coverage warnings outranking deductible improvements)
 * - Stripped before returning to match Highlight schema
 */
type HighlightWithPriority = Highlight & { _priority: number };

/**
 * Generate highlights from coverage and cost differences
 * 
 * Explicit priority order (enforced via _priority field):
 * 0 = Cost savings (if offer is cheaper)
 * 1 = New coverages in offer (not in current)
 * 2 = Higher coverage limits in offer
 * 3 = Lower deductibles in offer
 * 4 = Removed coverages (warnings)
 */
export function generateHighlights(input: HighlightsInput): Highlight[] {
  const highlights: HighlightWithPriority[] = [];
  const { coverageRows, currentAnnualPremium, offerAnnualPremium, policyType } = input;

  // PRIORITY 0: Cost savings highlight (if significant)
  const annualSavings = currentAnnualPremium - offerAnnualPremium;
  if (annualSavings > 0) {
    const savingsPercent = (annualSavings / currentAnnualPremium) * 100;
    if (savingsPercent >= 5) { // Only show if ≥5% savings
      highlights.push({
        title: "Lavere pris",
        description: `Spar ${formatCurrency(annualSavings)} årligt`,
        icon: "piggy-bank",
        variant: "success",
        category: "price",
        _priority: 0
      });
    }
  }

  // Analyze coverage differences
  for (const row of coverageRows) {
    // PRIORITY 1: New coverage in offer (not in current)
    if (row.current.value === 'ikke inkluderet' && row.offer.value !== 'ikke inkluderet') {
      highlights.push({
        title: `${row.coverage} inkluderet`,
        description: row.offer.limit ? `Med dækning på ${row.offer.limit}` : 'Ny dækning i tilbuddet',
        icon: getIconForCoverage(row.coverage),
        variant: "success",
        category: "coverage",
        _priority: 1
      });
    }
    
    // PRIORITY 2: Higher coverage limit in offer
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
            category: "coverage",
            _priority: 2
          });
        }
      }
    }
    
    // PRIORITY 3: Lower deductible in offer
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
          category: "deductible",
          _priority: 3
        });
      }
    }
    
    // PRIORITY 4: Coverage removed in offer (warning)
    if (row.current.value !== 'ikke inkluderet' && row.offer.value === 'ikke inkluderet') {
      highlights.push({
        title: `${row.coverage} ikke inkluderet`,
        description: 'Dækning fjernet i tilbuddet',
        icon: "info",
        variant: "warning",
        category: "coverage",
        _priority: 4
      });
    }
  }

  // Sort by explicit priority, then return top 4 (matches Tryg design)
  const sortedHighlights = highlights.sort((a, b) => a._priority - b._priority);
  
  // Remove internal _priority field before returning
  return sortedHighlights.slice(0, 4).map(({ _priority, ...highlight }) => highlight);
}

/**
 * Parse currency string to number
 * Handles formats: "1.000 kr", "1.000.000", "1000", "1000 kr", "1.000.000,50 kr"
 * Danish format: . for thousands, , for decimals
 */
function parseCurrency(value: string): number {
  if (!value || typeof value !== 'string') return 0;
  
  // Remove all whitespace and common suffixes
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/kr\.?$/g, '');
  
  if (cleaned === '') return 0;
  
  // Danish format: . for thousands, , for decimals
  // Convert to standard number format: remove thousand separators, replace decimal comma with dot
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format currency for display (consistent with Danish format)
 */
function formatCurrency(amount: number): string {
  if (isNaN(amount)) return '0 kr';
  
  if (amount >= 1000000) {
    const millions = (amount / 1000000).toFixed(1).replace('.', ',');
    return `${millions}M kr`;
  } else if (amount >= 1000) {
    const thousands = Math.round(amount / 1000);
    return `${thousands}k kr`;
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

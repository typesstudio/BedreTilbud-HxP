import { StructuredPolicy, Coverage } from "../services/policyExtractorService";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates Phase 1 extraction output before passing to Phase 2.
 * 
 * Ensures:
 * - All required fields present
 * - Coverage arrays properly structured
 * - Deductible/limit values properly formatted
 * - No data loss from OCR → structured extraction
 */
export class CoverageValidator {
  /**
   * Validates a single structured policy from Phase 1 extraction.
   */
  validatePolicy(policy: StructuredPolicy): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!policy.policyType) {
      errors.push("Missing policyType");
    }

    if (!policy.policyName) {
      errors.push("Missing policyName");
    }

    if (!policy.coverageDetails) {
      errors.push("Missing coverageDetails");
      return { isValid: false, errors, warnings };
    }

    // Coverage arrays validation
    if (!Array.isArray(policy.coverageDetails.mainCoverages)) {
      errors.push("mainCoverages must be an array");
    }

    if (!Array.isArray(policy.coverageDetails.additionalCoverages)) {
      errors.push("additionalCoverages must be an array");
    }

    // Validate individual coverages
    const mainCoverages = policy.coverageDetails.mainCoverages || [];
    const additionalCoverages = policy.coverageDetails.additionalCoverages || [];

    mainCoverages.forEach((coverage, idx) => {
      this.validateCoverage(coverage, `mainCoverages[${idx}]`, errors, warnings);
    });

    additionalCoverages.forEach((coverage, idx) => {
      this.validateCoverage(coverage, `additionalCoverages[${idx}]`, errors, warnings);
    });

    // Quality checks
    const totalCoverages = mainCoverages.length + additionalCoverages.length;
    if (totalCoverages === 0) {
      warnings.push("No coverages extracted - this may indicate OCR quality issues");
    }

    if (totalCoverages < 3) {
      warnings.push(`Only ${totalCoverages} coverages extracted - expected more for typical policies`);
    }

    // Premium validation
    if (policy.annualPremium === null) {
      warnings.push("Annual premium not extracted - Phase 2 analysis may be less accurate");
    } else if (policy.annualPremium <= 0) {
      errors.push(`Invalid annual premium: ${policy.annualPremium}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates a single coverage entry.
   */
  private validateCoverage(
    coverage: Coverage,
    path: string,
    errors: string[],
    warnings: string[]
  ): void {
    // Required: name
    if (!coverage.name || coverage.name.trim() === "") {
      errors.push(`${path}: Missing or empty name`);
    }

    // Deductible validation
    if (coverage.deductible !== null) {
      if (!this.isValidDanishAmount(coverage.deductible)) {
        warnings.push(`${path}.deductible: Invalid format "${coverage.deductible}" - expected Danish format like "2.834 kr"`);
      }
    }

    // Limit validation
    if (coverage.limit !== null) {
      if (!this.isValidDanishAmount(coverage.limit)) {
        warnings.push(`${path}.limit: Invalid format "${coverage.limit}" - expected Danish format like "62.344 kr"`);
      }
    }

    // included flag validation
    if (typeof coverage.included !== 'boolean') {
      errors.push(`${path}: included must be a boolean`);
    }
  }

  /**
   * Validates Danish amount format (e.g., "2.834 kr", "5.000 kr", "410.901 kr")
   * Also accepts percentages like "10% (min. 2.500 kr)"
   */
  private isValidDanishAmount(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }

    // Allow percentages with min/max clauses
    if (value.includes('%')) {
      return true; // Lenient validation for complex cases
    }

    // Standard Danish amount pattern: thousands separator (.), optional spaces, "kr"
    // Examples: "2.834 kr", "5.000 kr", "410.901 kr", "0 kr"
    const danishAmountPattern = /^[\d.]+\s*kr\.?$/i;
    return danishAmountPattern.test(value.trim());
  }

  /**
   * Validates that Phase 1 output can be safely processed by Phase 2.
   * Returns aggregated validation result for all policies.
   */
  validateExtractionResult(policies: StructuredPolicy[]): ValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    if (!Array.isArray(policies)) {
      return {
        isValid: false,
        errors: ["policies must be an array"],
        warnings: []
      };
    }

    if (policies.length === 0) {
      return {
        isValid: false,
        errors: ["No policies extracted from document"],
        warnings: []
      };
    }

    policies.forEach((policy, idx) => {
      const result = this.validatePolicy(policy);
      
      result.errors.forEach(err => {
        allErrors.push(`Policy ${idx + 1}: ${err}`);
      });

      result.warnings.forEach(warn => {
        allWarnings.push(`Policy ${idx + 1}: ${warn}`);
      });
    });

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings
    };
  }

  /**
   * Counts total coverages across all policies.
   * Useful for Phase 2 validation (ensuring 1:1 mapping).
   */
  countTotalCoverages(policy: StructuredPolicy): number {
    const mainCount = policy.coverageDetails?.mainCoverages?.length || 0;
    const additionalCount = policy.coverageDetails?.additionalCoverages?.length || 0;
    return mainCount + additionalCount;
  }
}

export const coverageValidator = new CoverageValidator();
